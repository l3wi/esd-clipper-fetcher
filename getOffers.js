require('dotenv').config()

const { ethers } = require('ethers')
const {
  DAO_ADDRESS,
  DAO_ABI,
  CLIPPER_ABI,
  CLIPPER_ADDRESS,
} = require('./presets')
const atob = (a) => Buffer.from(a, 'base64').toString('binary')

let provider = new ethers.providers.JsonRpcProvider(process.env.NODE_URL)

const fetchCoupons = async (account) => {
  let dao = new ethers.Contract(DAO_ADDRESS, DAO_ABI, provider)
  // Get current Epoch
  const epoch = await dao.epoch()

  //Fetch all ballances
  const couponArray = await Promise.all(
    Array(90)
      .fill('x')
      .map(async (_, i) => {
        return {
          epoch: epoch - 90 + i,
          coupons: parseFloat(
            ethers.utils.formatUnits(
              (await dao.balanceOfCoupons(account, epoch - 90 + i)).toString(),
              18
            )
          ),
        }
      })
  )

  return couponArray
}

// Check the Clipper approval on the DAO address
const checkApproval = async (account) => {
  let dao = new ethers.Contract(DAO_ADDRESS, DAO_ABI, provider)
  const approval = await dao.allowanceCoupons(account, CLIPPER_ADDRESS)
  return approval.toString()
}

// Main call
const fetchOffers = async () => {
  // Load up the contract
  let clipper = new ethers.Contract(CLIPPER_ADDRESS, CLIPPER_ABI, provider)
  const inter = new ethers.utils.Interface(CLIPPER_ABI)

  // Setup filter
  const filter = clipper.filters.SetOffer()
  const offers = await clipper.queryFilter(filter, 0, 'latest')

  // Give us an array to fill
  let onChainOffers = {}

  // Loop through offers and save them but overwrite with the *most recent* one
  offers.map((offer) => {
    if (!onChainOffers[offer.args.user])
      onChainOffers[offer.args.user] = {
        offer: offer.args.offer.toNumber(),
        blockNumber: offer.blockNumber,
      }
    if (onChainOffers[offer.args.user].blockNumber > offer.blockNumber) return
    onChainOffers[offer.args.user].offer = offer.args.offer.toNumber()
  })

  // Fetch approval status from all the setOffer callers
  await Promise.all(
    Object.keys(onChainOffers).map(async (address) => {
      onChainOffers[address].approval = await checkApproval(address)
    })
  )
  // Fetch balances of the addresses with live balances
  const balances = await Promise.all(
    Object.keys(onChainOffers).map(async (address) =>
      (await fetchCoupons(address)).reduce((a, c) => {
        return {
          address,
          coupons: a.coupons + c.coupons,
        }
      })
    )
  )

  return Object.keys(onChainOffers)
    .map((item) => {
      return {
        offer: onChainOffers[item].offer,
        approval: onChainOffers[item].approval != '0' ? true : false,
        address: item,
        coupons: balances.find((obj) => obj.address === item).coupons,
      }
    })
    .sort((a, b) => b.offer * b.coupons - a.offer * a.coupons)
}

module.exports = fetchOffers
