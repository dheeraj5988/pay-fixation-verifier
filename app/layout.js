import './globals.css';

export const metadata = {
  title: 'Pay Fixation Verifier',
  description: 'Rajasthan State Government pay fixation audit tool',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}