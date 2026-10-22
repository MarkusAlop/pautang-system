export const QR_PAYMENT_METHODS = ['MariBank', 'GCash', 'Maya', 'GoTyme'];

const STORAGE_KEY = 'pautang.paymentQrImages';
const QR_FILE_NAMES = {
  MariBank: 'maribank.png',
  GCash: 'gcash.png',
  Maya: 'maya.png',
  GoTyme: 'gotyme.png'
};

export function getPaymentQrFilePath(method) {
  const fileName = QR_FILE_NAMES[method];
  return fileName ? `/payment-qrs/${fileName}` : '';
}

export function loadPaymentQrs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function savePaymentQr(method, imageData) {
  if (!QR_PAYMENT_METHODS.includes(method)) {
    throw new Error('Unsupported payment method.');
  }

  const paymentQrs = { ...loadPaymentQrs(), [method]: imageData };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paymentQrs));
  return paymentQrs;
}

export function removePaymentQr(method) {
  const paymentQrs = loadPaymentQrs();
  delete paymentQrs[method];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paymentQrs));
  return paymentQrs;
}