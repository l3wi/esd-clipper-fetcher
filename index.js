const fetchOffers = require('./getOffers.js')
const cache = require('micro-cacheable')

const getOffers = async (req, res) => {
  return await fetchOffers()
}
module.exports = cache(15 * 60 * 1000, getOffers)
