// "What's new" notes for the POS (components/UpdateNotice.tsx).
// WHEN YOU DEPLOY A CHANGE that staff should know about, add a new entry at the TOP of RELEASES with a new, unique
// id. Every user is then shown it once, after signing in, and must read it before closing. Write it for shop staff:
// short, plain sentences about what is different at the till and in the office.

export type Release = {
  /** Unique and never reused, e.g. "2026-11-27a". Changing it is what makes the pop-up show again. */
  id: string;
  /** Shown under the heading. */
  date: string;
  title: string;
  /** One change per line: a short name and what it means for the user. */
  changes: [string, string][];
};

export const RELEASES: Release[] = [
  {
    id: '2026-11-27a',
    date: '27 November 2026',
    title: 'Payments, receipts and update notices',
    changes: [
      ['Choose the payment method', 'No method is selected for you on “Take payment”. Choose how the customer is paying. The receipt and invoice appear only after the payment is made. (The Credit sale screen still starts on Credit sale.)'],
      ['Confirm money you have received', 'For GhPay, tick that the money has arrived. For a split payment, tick both parts. Only then can you complete the sale.'],
      ['Credit sale deposits', 'If the customer pays something now, choose Cash, Mobile Money or GhPay and tick that you received it. Only cash deposits count in your cash drawer.'],
      ['Put on account', 'You are now asked to confirm before a sale is put on a customer’s account.'],
      ['Receipts', 'A dashed line now separates the items from the Subtotal on sales and credit sales receipts. The receipt thanks the customer by name, and the GRA E-VAT code is gone: the large QR code at the bottom is the one to scan at Return / exchange to find the sale.'],
      ['Messages to particular people', 'The Admin can now send a message to particular employees by name, as well as to whole groups.'],
      ['Camera or barcode scanner', 'Under “Scanning with”, tap Camera to scan with the device camera: your browser asks to allow the camera, then the scanner opens. Tap Barcode scanner to use a USB or Bluetooth scanner instead: the camera turns off and the search box is ready. You can switch at any time.'],
      ['Signing in and out by QR', 'To scan the gate QR code, open your profile at the top right of the home screen and choose “My sign-in, ID card, payslips & leave”.'],
      ['Your photo', 'Add your picture from your profile at the top right (tap the picture in the menu) or from your profile at the bottom of the side menu. It saves as soon as you choose it.'],
      ['Install the app', 'The sign-in page now shows “Install MNest UnifiedPOS” until you close it. Installing asks for your username and 6-digit passcode.'],
      ['Update notices', 'When the system is updated, you will see this window. Read the changes, then close it. If an update arrives while you are working, finish your sale and tap “Update now”.'],
    ],
  },
];
