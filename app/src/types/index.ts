// ========================================
// ShopFin MVP — TypeScript Data Models
// ========================================

/** File types supported by ShopFin */
export type FileType = 'income' | 'orders' | 'products' | 'wallet';

/** Upload status for each file type */
export type FileStatus = 'pending' | 'uploading' | 'parsing' | 'success' | 'error';

/** Info about an uploaded file */
export interface UploadedFile {
  type: FileType;
  name: string;
  size: number;
  status: FileStatus;
  error?: string;
}

// ========================================
// Parsed Data Models
// ========================================

/** Income Report Summary (from Excel Summary sheet) */
export interface IncomeReport {
  // Account info
  shopName: string;               // deta.unisex
  period: { from: string; to: string };

  // Product revenue
  totalRevenue: number;           // 1. Tổng doanh thu = 244,085,570
  productTotal: number;           // Tổng hàng hóa = 244,102,070
  originalPrice: number;          // Giá gốc = 370,654,000
  sellerDiscount: number;         // Số tiền bạn trợ giá = -113,525,830
  refundAmount: number;           // Số tiền hoàn lại = -13,026,100

  // Discounts
  sellerCoupon: number;           // Mã ưu đãi do Người Bán chịu = -16,500
  totalDiscounts: number;         // Mã giảm giá & Mức chiết khấu = -16,500

  // Costs
  totalCosts: number;             // 2. Tổng chi phí = -73,073,966

  // Shipping
  shippingBuyerPaid: number;      // Phí VC Người mua trả = 2,672,400
  shippingActual: number;         // Phí VC thực tế = -35,083,700
  shippingShopeeSubsidy: number;  // Phí VC được trợ giá từ Shopee = 32,411,300
  shippingReturn: number;         // Phí VC trả hàng = -1,086,100
  shippingPiship: number;         // Phí VC hoàn bởi PiShip = 1,455,400

  // Transaction fees
  fixedFee: number;               // Phí cố định = -38,349,600
  serviceFee: number;             // Phí Dịch Vụ = -12,533,757
  paymentFee: number;             // Phí thanh toán = -12,116,052
  affiliateFee: number;           // Phí hoa hồng TTLK = -4,807,814
  pishipFee: number;              // Phí dịch vụ PiShip = -1,605,420
  totalFees: number;              // Phụ phí (tổng) = -69,412,643

  // Tax
  vatTax: number;                 // Thuế GTGT = -2,440,856
  pitTax: number;                 // Thuế TNCN = -1,220,467
  totalTax: number;               // Thuế (tổng) = -3,661,323

  // Final
  netRevenue: number;             // 3. Tổng số tiền = 171,011,604
}

/** Single income record per order (from Excel "Doanh thu" sheet) */
export interface IncomeOrderRecord {
  transactionId: number;
  rowType: 'Order' | 'Sku';
  orderId: string;
  productId?: string;
  productName?: string;
  orderDate: string;
  paymentDate: string;
  paymentMethod: string;
  orderType: string;

  // Amounts
  totalPaid: number;               // Tổng tiền đã thanh toán
  productPrice: number;            // Giá sản phẩm
  refund: number;                  // Số tiền hoàn lại

  // Shipping
  shippingBuyerPaid: number;
  shippingActual: number;
  shippingShopeeSubsidy: number;
  shippingReturn: number;
  shippingPiship: number;
  shippingFailedDelivery: number;

  // Fees
  fixedFee: number;
  serviceFee: number;
  paymentFee: number;
  affiliateFee: number;
  pishipServiceFee: number;

  // Tax
  vatTax: number;
  pitTax: number;
}

/** Daily income aggregated from IncomeOrderRecords */
export interface DailyIncome {
  date: string;                    // "2026-01-01"
  orderCount: number;
  productPrice: number;            // Giá SP gộp
  refund: number;                  // Hoàn lại
  netProductRevenue: number;       // SP - hoàn lại
  fixedFee: number;
  serviceFee: number;
  paymentFee: number;
  affiliateFee: number;
  pishipFee: number;
  totalFees: number;               // Tổng phí
  vatTax: number;
  pitTax: number;
  totalTax: number;
  totalPayment: number;            // Tổng thanh toán net
}

/** Adjustment record */
export interface AdjustmentRecord {
  date: string;
  type: string;
  amount: number;
  relatedOrderId: string;
}

/** Order statuses from Shopee */
export type OrderStatus = 'completed' | 'cancelled' | 'pending' | 'shipping' | 'returning' | 'other';

/** Single order record from Excel Đơn hàng */
export interface OrderRecord {
  orderId: string;
  status: OrderStatus;
  totalAmount: number;
  orderDate: string;
}

/** Daily product data from Excel Sản phẩm */
export interface DailyProductData {
  date: string;
  pageViews: number;
  visitors: number;
  confirmedSales: number;
}

/** Wallet transaction types */
export type WalletTransactionType = 'income' | 'ads_expense' | 'withdrawal' | 'other';

/** Single wallet transaction from Excel Giao dịch Ví */
export interface WalletTransaction {
  date: string;
  type: WalletTransactionType;
  amount: number;
  description: string;
}

// ========================================
// Computed / Derived Data
// ========================================

/** Dashboard KPI metrics */
export interface DashboardMetrics {
  totalRevenue: number;        // Tổng doanh thu (sản phẩm net)
  netRevenue: number;          // Doanh thu thực nhận (sau phí + thuế)
  totalFees: number;           // Tổng phí sàn
  totalTax: number;            // Tổng thuế
  adsExpense: number;          // Chi phí Ads (từ ví)
  feeRatio: number;            // Tỷ lệ phí sàn (%)
  roas: number;                // ROAS
  cancelRate: number;          // Tỷ lệ hủy đơn (%)
  totalOrders: number;         // Tổng đơn
  cancelledOrders: number;     // Đơn hủy
  // Fee breakdown for chart
  fixedFee: number;
  serviceFee: number;
  paymentFee: number;
  affiliateFee: number;
  pishipFee: number;
  vatTax: number;
  pitTax: number;
}

/** Daily performance row (merged from income + products) */
export interface DailyPerformance {
  date: string;
  // From Income Excel (primary)
  productRevenue: number;      // Giá SP
  netPayment: number;          // Tổng TT đã chuyển
  totalFees: number;           // Tổng phí ngày đó
  orderCount: number;          // Số đơn
  // From Product Excel
  pageViews: number;
  visitors: number;
  confirmedSales: number;
  // From Wallet
  walletIncome: number;
}

/** Cashflow audit data */
export interface CashflowAudit {
  reportedRevenue: number;     // Doanh thu theo báo cáo Income
  actualWalletIncome: number;  // Tiền về ví thực tế
  difference: number;
  differencePercent: number;
  status: 'ok' | 'warning' | 'danger';
}

/** Pending order (đơn treo) */
export interface PendingOrder {
  orderId: string;
  amount: number;
  status: 'waiting' | 'needs_review';
  daysPending: number;
}

// ========================================
// Store State
// ========================================

/** Global app state */
export interface ShopDataState {
  // Upload
  uploadedFiles: Record<FileType, UploadedFile | null>;

  // Parsed raw data
  incomeReport: IncomeReport | null;
  incomeOrders: IncomeOrderRecord[];
  dailyIncome: DailyIncome[];
  adjustments: AdjustmentRecord[];
  orders: OrderRecord[];
  dailyProducts: DailyProductData[];
  walletTransactions: WalletTransaction[];

  // Computed
  dashboardMetrics: DashboardMetrics | null;
  dailyPerformance: DailyPerformance[];
  cashflowAudit: CashflowAudit | null;
  pendingOrders: PendingOrder[];

  // UI state
  isProcessing: boolean;
  hasData: boolean;
}
