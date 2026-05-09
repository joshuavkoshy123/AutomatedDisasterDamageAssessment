import type { EvaluationMetrics, ConfusionMatrixData } from '../types';

export const mockMetrics: EvaluationMetrics = {
  accuracy: 0.6284,
  precision: 0.3708,
  recall: 0.3549,
  f1Score: 0.3512,
  totalBuildings: 7715,
  byClass: {
    'no-damage': { precision: 0.66, recall: 0.87, f1: 0.751, support: 4167, correct: 3642 },
    'minor-damage': { precision: 0.12, recall: 0.06, f1: 0.079, support: 871, correct: 51 },
    'major-damage': { precision: 0.70, recall: 0.49, f1: 0.576, support: 2371, correct: 1155 },
    'destroyed': { precision: 0.00, recall: 0.00, f1: 0.00, support: 196, correct: 0 },
    'un-classified': { precision: 0.00, recall: 0.00, f1: 0.00, support: 0, correct: 0 },
  }
};

export const mockConfusionMatrix: ConfusionMatrixData = {
  labels: ['no-damage', 'minor-damage', 'major-damage', 'destroyed'],
  matrix: [
    [3642,  259,   266,   0],
    [ 716, 51,  104,  0],
    [ 1123,  93, 1155,  0],
    [  69,  10,  117, 0],
  ]
};