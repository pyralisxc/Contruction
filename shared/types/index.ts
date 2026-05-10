export interface IBuilding {
  id: string;
  name: string;
  rooms: IRoom[];
  walls: IWall[];
  floors: IFloor[];
  framing: IFraming[];
  electrical: IElectrical[];
  plumbing: IPlumbing[];
  materials: IMaterial[];
  codeCompliance: IBuildingCode[];
}

export interface IRoom {
  id: string;
  name: string;
  walls: IWall[];
  floors: IFloor[];
  framing: IFraming[];
}

export interface IWall {
  id: string;
  position: [number, number, number];
  length: number;
  studs: IStud[];
  framing: IFraming[];
}

export interface IStud {
  id: string;
  position: [number, number, number];
  length: number;
}

export interface IFloor {
  id: string;
  position: [number, number, number];
  thickness: number;
  ceiling: boolean;
}

export interface IFraming {
  id: string;
  type: 'stud' | 'joist' | 'rafter';
  position: [number, number, number];
  length: number;
}

export interface IElectrical {
  id: string;
  type: 'circuit' | 'wire' | 'outlet' | 'switch';
  position: [number, number, number];
  circuitId?: string;
}

export interface IPlumbing {
  id: string;
  type: 'pipe' | 'fixture' | 'connection';
  position: [number, number, number];
  connectedTo?: string;
}

export interface IMaterial {
  id: string;
  name: string;
  specs: {
    density: number;
    thermalConductivity: number;
    costPerUnit: number;
  };
}

export interface IBuildingCode {
  id: string;
  rule: string;
  complianceStatus: 'compliant' | 'non-compliant';
  notes: string;
}

export * from './store'
export * from './siteIntelligence'
