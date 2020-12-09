const fetchOffers = require('./getOffers.js')
const cache = require('micro-cacheable')
const cors = require('micro-cors')()

const getOffers = async (req, res) => {
  return await fetchOffers()
}

const corsPass = cache(15 * 60 * 1000, getOffers)

module.exports = cors(corsPass)
