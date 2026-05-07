export interface WorkOrderItem {
  sNo: number;
  description: string;
  numbers: number;
  length: number;
  breadth: number;
  depth: number;
  quantity: number;
  rate: number;
  unit: string;
  amount: number;
  isMaterial: 'Yes' | 'No';
}

export interface WorkOrderTotals {
  totalAmount: number;
  gst: number;
  grandTotal: number;
}
