// Exécuté avec logs-core.js et les deux fonctions de classement/histogramme.
// Les assertions portent sur les résultats métier, sans dépendre du rendu DOM.
function assert(condition, message) { if (!condition) throw new Error(message); }
function rejects(fn, message) { let failed = false; try { fn(); } catch (_) { failed = true; } assert(failed, message); }
const header = 'multDepth,batchSize,ringsize,title,operation,unit,time,run\n';
const csv = header + [
  '25,8,16,"SYNC, DC0",SYNC,SECONDS,2,1',
  '25,8,16,received,CIPHER_SYNC,UNIT,4,1',
  '25,8,16,prepare,PREP,MILLISECONDS,500,1',
  '25,8,16,other DC,SYNC,SECONDS,99,1',
  '25,8,16,next,SYNC,MICROSECONDS,1000,2',
  '25,8,16,received,CIPHER_SYNC,UNIT,3,2'
].join('\n');
const parsed = parseLogCSV('\uFEFF' + csv);
assert(parsed[0].title === 'SYNC, DC0', 'CSV quoted comma/BOM');
const multiline = parseLogCSV(header + '25,8,16,"one\n""two""",SYNC,SECONDS,1,1');
assert(multiline[0].title === 'one\n"two"', 'CSV multiline/escaped quotes');
rejects(() => parseLogCSV('foo,bar\n1,2'), 'Reject missing columns');
rejects(() => parseLogCSV(header + '25,8,16,test,SYNC,SECONDS,no,1'), 'Reject invalid time');
rejects(() => parseLogCSV(header + '25,8,16,"unfinished'), 'Reject unclosed quotes');
const enriched = enrichLogs(parsed);
assert(enriched[0].time_ms === 2000 && enriched[4].time_ms === 1, 'Time conversions');
assert(enriched[3].data_center === 'DC1' && enriched[4].data_center === 'DC0', 'DC counter resets each iteration');
const aggregate = aggregateLogs(enriched);
const sync2 = aggregate.find(g => g.iteration === 2 && g.data_center === 'DC0');
assert(sync2.chiffres_recus === 3 && sync2.cumulative_leakage === 7, 'Cumulative ciphertexts');
logAgg = aggregate;
const hist = histogramData('DC0');
assert(JSON.stringify(hist.iterations) === '[1,2]', 'Iteration ordering');
assert(hist.series[0][0] === 2 && hist.series[4][0] === 2.5, 'Histogram DC filter/seconds/total');
assert(hist.series[1][0] === null, 'Absent duration is not zero');
assert(histogramData('missing').iterations.length === 0, 'Empty DC');
const graph = { hasNode: n => ['0', '1', '2'].includes(n), getNodeAttribute: n => n === '1' ? 'DC1' : 'DC0' };
const scores = [['0', .1, .11], ['1', .3, .31], ['2', .2, null], ['3', .9, .9]];
assert(referenceTopScores(scores, graph, 'all')[0][0] === '1', 'Ranking descending/unknown nodes excluded');
assert(referenceTopScores(scores, graph, 'DC0')[0][0] === '2', 'Ranking DC filter');
assert(referenceTopScores([['0', null, .2]], graph, 'all').length === 0, 'Invalid reference excluded');
assert(referenceTopScores(scores, graph, 'all')[1][2] === null, 'Missing Poppy preserved');
console.log('OK : CSV, unités, attribution DC, cumul, histogramme et classement.');

const delivered = aggregateLogs(enrichLogs(parseLogCSV(deliveredCSV)));
assert(new Set(delivered.filter(g => g.data_center !== 'ALL').map(g => g.data_center)).size === 5, 'Delivered CSV: five DC');
assert(new Set(delivered.map(g => g.iteration)).size === 10, 'Delivered CSV: ten iterations');
for (const dc of ['DC0', 'DC1', 'DC2', 'DC3', 'DC4']) {
  const sync = delivered.filter(g => g.data_center === dc && g.step === 'SYNC');
  assert(sync.length === 10, 'Ten SYNC blocks for ' + dc);
  let cumulative = 0;
  for (const row of sync) {
    cumulative += row.chiffres_recus ?? 0;
    assert(row.cumulative_leakage === cumulative, 'Delivered cumulative count for ' + dc);
  }
}
