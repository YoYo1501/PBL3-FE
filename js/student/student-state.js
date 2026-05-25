/**
 * student-state.js – Shared state for the student portal modules.
 * Kết nối với BE qua api.js (callApi / callApiPublic)
 */

// =====================================================================
// GLOBAL STATE
// =====================================================================
let currentReqType = 'Other'; // loại yêu cầu đang hiển thị
let transferRooms  = [];       // danh sách phòng có thể chuyển
let currentFacilities = [];     // danh sách thiết bị trong phòng hiện tại
let currentFacilityRoom = null;  // thông tin phòng dùng cho trang cơ sở vật chất
let currentFacilityRepairHistory = []; // lịch sử báo hỏng/sửa chữa
let currentInvoices = [];
let currentReceipts = [];
let selectedInvoiceId = null;
let invoiceActiveTab = 'invoice';
let invoiceStatusFilter = '';
let invoiceSearchTerm = '';
let invoiceSearchDebounceTimer = null;
let receiptMethodFilter = '';
let receiptDateFrom = '';
let receiptDateTo = '';
let receiptMonthFilter = '';
let receiptPage = 1;
const RECEIPT_PAGE_SIZE = 5;
let requestStatusFilter = '';
let transferStatusFilter = '';
let currentNotifications = [];
let notificationFilter = 'all';
let notificationPage = 1;
const NOTIFICATION_PAGE_SIZE = 5;

// =====================================================================
