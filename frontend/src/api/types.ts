// Aliases of the generated contract types. Nothing here is handwritten shape (acceptance F-4).
// Regenerate schema.d.ts with `npm run gen:api` whenever docs/openapi.yaml changes.
import type { components } from './schema';

type S = components['schemas'];

export type ErrorBody = S['Error'];
export type Terminal = S['Terminal'];
export type Warehouse = S['Warehouse'];
export type Truck = S['Truck'];
export type SensitivePlace = S['SensitivePlace'];
export type Network = S['Network'];
export type Route = S['Route'];
export type Evaluation = S['Evaluation'];
export type Indicators = S['Indicators'];
export type Check = S['Check'];
export type IndicatorSet = S['IndicatorSet'];
export type ShipmentRow = S['ShipmentRow'];
export type Area = S['Area'];
export type DisruptionKind = S['DisruptionKind'];
export type DisruptionCreate = S['DisruptionCreate'];
export type Disruption = S['Disruption'];
export type DisruptionUpdate = S['DisruptionUpdate'];
export type Verification = Disruption['verification'];
export type Preset = S['Preset'];
export type Weights = S['Weights'];
export type Settings = S['Settings'];
export type Board = S['Board'];
export type OptionKind = S['OptionKind'];
export type Burden = S['Burden'];
export type OptionDelta = S['OptionDelta'];
export type OptionScores = S['OptionScores'];
export type Collateral = S['Collateral'];
export type ResponseOption = S['Option'];
export type OptionsResponse = S['OptionsResponse'];
export type DecisionCreate = S['DecisionCreate'];
export type Decision = S['Decision'];
export type DecisionResult = S['DecisionResult'];
export type ValueKind = S['ValueKind'];
export type Method = S['Method'];
export type FeedCandidates = S['FeedCandidates'];
export type StudioSession = S['StudioSession'];
export type StudioSessionCreate = S['StudioSessionCreate'];
export type StudioObstacleCreate = S['StudioObstacleCreate'];
export type StudioAlternative = S['StudioAlternative'];
export type Status = Evaluation['status'];
export type PresetList = { presets: Preset[] };
