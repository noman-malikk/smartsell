export const bitgetSpot = {
  symbol: 'TESTUSDT', baseCoin: 'TEST', quoteCoin: 'USDT', status: 'online',
  pricePrecision: '2', quantityPrecision: '3', minTradeAmount: '0', maxTradeAmount: '1000000',
  minTradeUSDT: '1', maxMarketOrderValue: '1000000',
};

export const bitgetFutures = {
  symbol: 'TESTUSDT', baseCoin: 'TEST', quoteCoin: 'USDT', symbolStatus: 'normal',
  symbolType: 'perpetual', supportMarginCoins: ['USDT'], pricePlace: '2', priceEndStep: '5',
  sizeMultiplier: '0.01', minTradeNum: '0.01', minTradeUSDT: '5', maxOrderQty: '10000', maxMarketOrderQty: '1000',
};
