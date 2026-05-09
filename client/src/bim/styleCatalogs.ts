import { FloorElement, RoofElement, WallElement } from './types'

export interface ElementStylePreset<T> {
  id: string
  name: string
  description: string
  updates: Partial<T>
}

export const floorStylePresets: ElementStylePreset<FloorElement>[] = [
  {
    id: 'raised-2x10-piers',
    name: 'Raised 2x10 floor on piers',
    description: 'Default raised platform with beams, bay blocking, posts, and pier blocks.',
    updates: {
      framingMode: 'raisedFloor',
      deckMode: 'none',
      assemblyId: 'floor-2x10',
      joistDirection: 'x',
      joistSize: '2x10',
      joistSpacing: 16,
      beamSpacing: 8,
      pierSpacing: 6,
      blockingPolicy: 'supportAndMidspan',
      beamLayout: 'edgeAndInterior',
      postLayout: 'underBeams',
      surfaceMaterialId: 'subfloor-3-4',
    },
  },
  {
    id: 'freestanding-deck',
    name: 'Freestanding deck',
    description: 'Deck platform with beams/posts on all support lines and no ledger dependency.',
    updates: {
      framingMode: 'deck',
      deckMode: 'freestanding',
      ledgerEdge: null,
      joistSize: '2x8',
      joistSpacing: 16,
      beamSpacing: 8,
      pierSpacing: 6,
      blockingPolicy: 'supportAndMidspan',
      beamLayout: 'edgeAndInterior',
      postLayout: 'underBeams',
      surfaceMaterialId: 'oak-flooring-3-4',
    },
  },
  {
    id: 'ledger-deck-north',
    name: 'Ledger deck, north edge',
    description: 'Deck platform attached at the north edge with ledger warnings and post-supported outer beams.',
    updates: {
      framingMode: 'deck',
      deckMode: 'ledger',
      ledgerEdge: 'north',
      joistSize: '2x8',
      joistSpacing: 16,
      beamSpacing: 8,
      pierSpacing: 6,
      blockingPolicy: 'supportAndMidspan',
      beamLayout: 'edgeAndInterior',
      postLayout: 'underBeams',
    },
  },
]

export const wallStylePresets: ElementStylePreset<WallElement>[] = [
  {
    id: 'ext-2x6-fiber-cement',
    name: 'Exterior 2x6 wall',
    description: 'Bearing exterior wall with 2x6 studs, double top plate, sheathing, wrap, and siding assembly.',
    updates: {
      wallKind: 'exterior',
      assemblyId: 'wall-ext-2x6',
      exterior: true,
      bearing: true,
      studSize: '2x6',
      studSpacing: 16,
      cornerStyle: 'threeStud',
      intersectionStyle: 'teeBacking',
      platePolicy: 'doubleTop',
      halfWallCap: false,
    },
  },
  {
    id: 'int-2x4-partition',
    name: 'Interior 2x4 partition',
    description: 'Non-bearing interior partition with drywall assembly.',
    updates: {
      wallKind: 'interior',
      assemblyId: 'wall-int-2x4',
      exterior: false,
      bearing: false,
      studSize: '2x4',
      studSpacing: 16,
      cornerStyle: 'threeStud',
      intersectionStyle: 'teeBacking',
      platePolicy: 'singleTop',
      halfWallCap: false,
    },
  },
  {
    id: 'half-wall-cap',
    name: 'Half wall with cap',
    description: 'Pony/half wall starter with cap plate and non-bearing framing.',
    updates: {
      wallKind: 'halfWall',
      assemblyId: 'wall-int-2x4',
      exterior: false,
      bearing: false,
      height: 3.5,
      studSize: '2x4',
      studSpacing: 16,
      platePolicy: 'singleTop',
      halfWallCap: true,
    },
  },
]

export const roofStylePresets: ElementStylePreset<RoofElement>[] = [
  {
    id: 'gable-asphalt',
    name: 'Gable asphalt roof',
    description: 'Common gable roof with rafters, ridge board, ties, battens/nailers, fascia, rake, and gable infill.',
    updates: {
      roofType: 'gable',
      assemblyId: 'roof-asphalt-gable',
      attachment: 'freestanding',
      ridgePolicy: 'ridgeBoard',
      purlinMode: 'roofBattenNailer',
      pitchRise: 6,
      pitchRun: 12,
      overhang: 1,
      eaveOverhang: 1,
      rakeOverhang: 1,
      rafterSize: '2x8',
      rafterSpacing: 24,
      roofingMaterialId: 'asphalt-shingle',
    },
  },
  {
    id: 'wall-attached-shed',
    name: 'Wall-attached shed roof',
    description: 'Lean-to starter roof for additions, porches, and side attachments.',
    updates: {
      roofType: 'shed',
      assemblyId: 'roof-asphalt-gable',
      attachment: 'wallAttachedShed',
      ridgePolicy: 'ridgeBoard',
      purlinMode: 'roofBattenNailer',
      pitchRise: 3,
      pitchRun: 12,
      eaveOverhang: 1,
      rakeOverhang: 1,
      rafterSize: '2x8',
      rafterSpacing: 16,
    },
  },
  {
    id: 'structural-purlin-gable',
    name: 'Gable with structural purlins',
    description: 'Gable roof mode that derives purlin struts down to bearing lines for review.',
    updates: {
      roofType: 'gable',
      attachment: 'freestanding',
      ridgePolicy: 'ridgeBoard',
      purlinMode: 'structuralPurlinWithStruts',
      pitchRise: 6,
      pitchRun: 12,
      rafterSize: '2x8',
      rafterSpacing: 24,
    },
  },
]
