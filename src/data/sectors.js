// Sector targets — your strategic allocation framework
window.SECTOR_TARGETS = {
  'Energy':              { min: 25, max: 30, color: '#2e6b4a',  priority: 1 },
  'Semiconductors':      { min: 20, max: 25, color: '#c4622d',  priority: 2 },
  'Alt. Managers':       { min: 15, max: 20, color: '#8b3a1a',  priority: 1 },
  'Consumer Tech':       { min: 10, max: 15, color: '#4a7aaa',  priority: 3 },
  // Power & Nuclear: power generation and fuel for AI-driven electricity demand.
  'Power & Nuclear':     { min: 8,  max: 12, color: '#6b5b95',  priority: 2 },
  // Commodities: a small core band for mining exposure.
  'Commodities':         { min: 4,  max: 8,  color: '#7a6030',  priority: 3 },
  'Enterprise Software': { min: 0,  max: 10, color: '#6b5444',  priority: 4 },
  'Industrials':         { min: 0,  max: 10, color: '#5a6b7a',  priority: 5 },
  'Crypto':              { min: 0,  max: 5,  color: '#9a7020',  priority: 5 },
  'Other':               { min: 0,  max: 10, color: '#b0a090',  priority: 5 },
};
// A sector with a floor above zero is a CORE sector: the deploy engine fills it
// toward its target. A sector with a floor of zero is optional: you may hold it,
// but the engine never puts new money there.

// Auto-sector mapping for tickers not in universe
window.SECTOR_MAP = {
  NVDA:'Semiconductors', TSM:'Semiconductors', AMD:'Semiconductors', AVGO:'Semiconductors',
  AMZN:'Consumer Tech', GOOGL:'Consumer Tech', GOOG:'Consumer Tech', META:'Consumer Tech',
  MSFT:'Consumer Tech', AAPL:'Consumer Tech',
  CVX:'Energy', XOM:'Energy', COP:'Energy', EOG:'Energy', SLB:'Energy', OXY:'Energy', WMB:'Energy',
  TTE:'Energy', CTRA:'Energy', SHEL:'Energy', BP:'Energy',
  CEG:'Power & Nuclear', VST:'Power & Nuclear', CCJ:'Power & Nuclear', GEV:'Power & Nuclear',
  TLN:'Power & Nuclear', NRG:'Power & Nuclear', BWXT:'Power & Nuclear', OKLO:'Power & Nuclear', SMR:'Power & Nuclear',
  RIO:'Commodities', FCX:'Commodities', BHP:'Commodities', VALE:'Commodities',
  GE:'Industrials', RTX:'Industrials', HON:'Industrials', BA:'Industrials',
  APO:'Alt. Managers', BX:'Alt. Managers', ARES:'Alt. Managers', KKR:'Alt. Managers', CG:'Alt. Managers', BAM:'Alt. Managers',
  PLTR:'Enterprise Software', SNOW:'Enterprise Software', CRM:'Enterprise Software',
  'BRK.B':'Other', BRK:'Other', V:'Other', MA:'Other', COST:'Other',
  BTC:'Crypto', ETH:'Crypto', 'BTC/USD':'Crypto', 'ETH/USD':'Crypto', FBTC:'Crypto', IBIT:'Crypto', GBTC:'Crypto',
  SPAXX:'Cash', USD:'Cash',
};
