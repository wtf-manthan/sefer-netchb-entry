/**
 * Mode of Transport (MOT) Codes
 * Source: NetCHB spec/data_type.xsd (modeTransportType) & CBP ACE CATAIR
 */

export interface ModeOfTransport {
  code: string;
  name: string;
  category: 'vessel' | 'rail' | 'truck' | 'air' | 'other';
}

export const MODES_OF_TRANSPORT: Record<string, ModeOfTransport> = {
  '10': { code: '10', name: 'Vessel, non-container', category: 'vessel' },
  '11': { code: '11', name: 'Vessel, container', category: 'vessel' },
  '20': { code: '20', name: 'Rail, non-container', category: 'rail' },
  '21': { code: '21', name: 'Rail, container', category: 'rail' },
  '30': { code: '30', name: 'Truck, non-container', category: 'truck' },
  '31': { code: '31', name: 'Truck, container', category: 'truck' },
  '40': { code: '40', name: 'Air, non-container', category: 'air' },
  '41': { code: '41', name: 'Air, container', category: 'air' },
  '50': { code: '50', name: 'Mail', category: 'other' },
  '60': { code: '60', name: 'Passenger, hand-carried', category: 'other' },
  '70': { code: '70', name: 'Fixed transport installation (pipeline)', category: 'other' },
};
