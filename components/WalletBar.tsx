"use client";

import { useWallet } from "../contexts/WalletContext";

export default function WalletBar() {
  const { address, connecting, checkingVerification, verified, error, connectWallet, openSsiVerificationPopup } =
    useWallet();

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Каталог курсів</h1>
          <p className="mt-1 text-sm text-muted">
            Запис відкритий для гаманців із підтвердженою SSI-ідентичністю.
          </p>
        </div>

        {address ? (
          <span className="rounded-full bg-surface-muted px-4 py-2 text-sm font-mono text-foreground">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        ) : (
          <button
            onClick={connectWallet}
            disabled={connecting}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {connecting ? "Підключення..." : "Увійти через MetaMask"}
          </button>
        )}
      </div>

      {address && (
        <div className="mt-4">
          {checkingVerification && <p className="text-sm text-muted">Перевірка верифікації...</p>}
          {!checkingVerification && verified === true && (
            <p className="inline-flex items-center gap-2 rounded-full bg-success-bg px-4 py-2 text-sm font-medium text-success">
              ✅ Верифіковано — SSI-ідентичність підтверджена
            </p>
          )}
          {!checkingVerification && verified === false && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-warning-bg px-5 py-4">
              <p className="text-sm font-medium text-warning">
                ⚠️ Не верифіковано — потрібна зареєстрована SSI-ідентичність
              </p>
              <button
                onClick={openSsiVerificationPopup}
                className="rounded-full bg-warning px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Верифікувати через SSI ↗
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
