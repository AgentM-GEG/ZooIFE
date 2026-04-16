export interface CaesarBBoxCountPayload {
  bbox_keys?: string[];
  bbox_num_masks?: Array<number | string>;
  aggregation_version?: string;
  [key: string]: unknown;
}

export interface CaesarBBoxCountEnvelope {
  data?: CaesarBBoxCountPayload;
  [key: string]: unknown;
}

export type CaesarBBoxCountReductionData = CaesarBBoxCountPayload | CaesarBBoxCountEnvelope[];

export interface CaesarMachineLearntMark {
  taskIndex?: number;
  toolIndex?: number;
  x_center?: number;
  y_center?: number;
  width?: number;
  height?: number;
  markId?: string | number;
  [key: string]: unknown;
}

export interface CaesarMachineLearntEnvelope {
  data?: CaesarMachineLearntMark[];
  [key: string]: unknown;
}

export type CaesarMachineLearntReductionData = CaesarMachineLearntEnvelope | CaesarMachineLearntEnvelope[];

/**
 * Subject reduction data structure from Caesar.
 */
export interface SubjectReduction<TData = unknown> {
  data: TData;
}

export type GenericSubjectReduction = SubjectReduction<unknown>;