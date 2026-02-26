import type { Building, EvaluationMetrics, ConfusionMatrixData, DisasterEvent } from '../types';

// Hurricane Harvey - Houston area mock data
export const mockBuildings: Building[] = [
  { id: 'b001', address: '1245 Almeda Rd, Houston, TX 77054', lat: 29.6880, lng: -95.3698, damageLevel: 'destroyed', modelPrediction: 'destroyed', femaLabel: 'destroyed', confidence: 0.94, notes: 'Complete structural failure' },
  { id: 'b002', address: '8823 Gulf Freeway, Houston, TX 77017', lat: 29.6752, lng: -95.2801, damageLevel: 'major-damage', modelPrediction: 'major-damage', femaLabel: 'major-damage', confidence: 0.88 },
  { id: 'b003', address: '3301 NASA Pkwy, Webster, TX 77598', lat: 29.5583, lng: -95.1142, damageLevel: 'minor-damage', modelPrediction: 'major-damage', femaLabel: 'minor-damage', confidence: 0.61 },
  { id: 'b004', address: '5500 Griggs Rd, Houston, TX 77021', lat: 29.6901, lng: -95.3344, damageLevel: 'no-damage', modelPrediction: 'no-damage', femaLabel: 'no-damage', confidence: 0.97 },
  { id: 'b005', address: '2100 Harvey Wilson Dr, Houston, TX 77020', lat: 29.7431, lng: -95.3098, damageLevel: 'major-damage', modelPrediction: 'destroyed', femaLabel: 'major-damage', confidence: 0.55 },
  { id: 'b006', address: '441 N Sam Houston Pkwy E, Houston, TX 77060', lat: 29.9338, lng: -95.4173, damageLevel: 'minor-damage', modelPrediction: 'minor-damage', femaLabel: 'minor-damage', confidence: 0.82 },
  { id: 'b007', address: '7600 Bellaire Blvd, Houston, TX 77036', lat: 29.7079, lng: -95.5142, damageLevel: 'destroyed', modelPrediction: 'major-damage', femaLabel: 'destroyed', confidence: 0.49 },
  { id: 'b008', address: '9901 Westheimer Rd, Houston, TX 77042', lat: 29.7369, lng: -95.5609, damageLevel: 'no-damage', modelPrediction: 'no-damage', femaLabel: 'no-damage', confidence: 0.99 },
  { id: 'b009', address: '12200 Fuqua St, Houston, TX 77034', lat: 29.6273, lng: -95.2321, damageLevel: 'major-damage', modelPrediction: 'major-damage', femaLabel: 'major-damage', confidence: 0.91 },
  { id: 'b010', address: '15803 El Camino Real, Houston, TX 77062', lat: 29.5799, lng: -95.1239, damageLevel: 'minor-damage', modelPrediction: 'no-damage', femaLabel: 'minor-damage', confidence: 0.38 },
  { id: 'b011', address: '4102 Telephone Rd, Houston, TX 77087', lat: 29.6691, lng: -95.3173, damageLevel: 'destroyed', modelPrediction: 'destroyed', femaLabel: 'destroyed', confidence: 0.96 },
  { id: 'b012', address: '19011 Kingsland Blvd, Katy, TX 77449', lat: 29.7871, lng: -95.8227, damageLevel: 'no-damage', modelPrediction: 'minor-damage', femaLabel: 'no-damage', confidence: 0.44 },
  { id: 'b013', address: '2350 Bingle Rd, Houston, TX 77055', lat: 29.7891, lng: -95.5089, damageLevel: 'major-damage', modelPrediction: 'major-damage', femaLabel: 'major-damage', confidence: 0.87 },
  { id: 'b014', address: '6770 Bertner Ave, Houston, TX 77030', lat: 29.7059, lng: -95.3978, damageLevel: 'no-damage', modelPrediction: 'no-damage', femaLabel: 'no-damage', confidence: 0.98 },
  { id: 'b015', address: '3302 Canal St, Houston, TX 77003', lat: 29.7480, lng: -95.3439, damageLevel: 'minor-damage', modelPrediction: 'minor-damage', femaLabel: 'minor-damage', confidence: 0.79 },
  { id: 'b016', address: '1100 Gessner Rd, Houston, TX 77055', lat: 29.7738, lng: -95.5302, damageLevel: 'destroyed', modelPrediction: 'destroyed', femaLabel: 'destroyed', confidence: 0.93 },
  { id: 'b017', address: '8200 Rosen Rd, Baytown, TX 77521', lat: 29.7360, lng: -94.9783, damageLevel: 'major-damage', modelPrediction: 'major-damage', femaLabel: 'major-damage', confidence: 0.85 },
  { id: 'b018', address: '5600 N Shepherd Dr, Houston, TX 77091', lat: 29.8441, lng: -95.3983, damageLevel: 'no-damage', modelPrediction: 'no-damage', femaLabel: 'no-damage', confidence: 0.96 },
  { id: 'b019', address: '2800 Mangum Rd, Houston, TX 77092', lat: 29.8130, lng: -95.4592, damageLevel: 'minor-damage', modelPrediction: 'major-damage', femaLabel: 'minor-damage', confidence: 0.57 },
  { id: 'b020', address: '11811 East Fwy, Houston, TX 77029', lat: 29.7580, lng: -95.2790, damageLevel: 'destroyed', modelPrediction: 'destroyed', femaLabel: 'destroyed', confidence: 0.91 },
];

export const mockMetrics: EvaluationMetrics = {
  accuracy: 0.7850,
  precision: 0.7612,
  recall: 0.7850,
  f1Score: 0.7665,
  totalBuildings: 1247,
  byClass: {
    'no-damage': { precision: 0.91, recall: 0.94, f1: 0.925, support: 412, correct: 388 },
    'minor-damage': { precision: 0.68, recall: 0.61, f1: 0.643, support: 298, correct: 182 },
    'major-damage': { precision: 0.74, recall: 0.79, f1: 0.764, support: 334, correct: 264 },
    'destroyed': { precision: 0.88, recall: 0.85, f1: 0.865, support: 203, correct: 173 },
    'un-classified': { precision: 0.00, recall: 0.00, f1: 0.00, support: 0, correct: 0 },
  }
};

export const mockConfusionMatrix: ConfusionMatrixData = {
  labels: ['no-damage', 'minor-damage', 'major-damage', 'destroyed'],
  matrix: [
    [388,  14,   8,   2],
    [ 22, 182,  71,  23],
    [ 11,  48, 264,  11],
    [  4,  12,  14, 173],
  ]
};

export const mockDisasterEvent: DisasterEvent = {
  id: 'harvey-2017',
  name: 'Hurricane Harvey',
  type: 'hurricane',
  date: '2017-08-25',
  location: 'Houston, TX',
  centerLat: 29.7604,
  centerLng: -95.3698,
  totalBuildings: 1247,
  damageSummary: {
    'no-damage': 412,
    'minor-damage': 298,
    'major-damage': 334,
    'destroyed': 203,
    'un-classified': 0,
  }
};
