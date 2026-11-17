// Carrega os módulos do jogo no Node (sem DOM) e devolve o namespace FF.
const path = require('path');
const ROOT = path.join(__dirname, '..', 'www', 'js');
const CORE = ['config.js', 'factory.js', 'routing.js', 'conveyor.js', 'simulation.js', 'levels.js', 'levels2.js', 'levels3.js', 'storage.js', 'transfer.js', 'modes.js'];

module.exports = function load() {
  for (const f of CORE) require(path.join(ROOT, f));
  return globalThis.FF;
};
