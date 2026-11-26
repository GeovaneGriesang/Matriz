/** O robô azul dos avisos do sistema: separa os avisos automáticos dos memorandos e das mensagens agendadas. */
export function RoboAzul({ tamanho = 22, titulo }: { tamanho?: number; titulo?: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" role={titulo ? "img" : undefined} aria-hidden={titulo ? undefined : true} aria-label={titulo}>
      <line x1="12" y1="2.5" x2="12" y2="5.5" stroke="#1d4ed8" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="2.5" r="1.4" fill="#3b82f6" />
      <rect x="4" y="5.5" width="16" height="12" rx="3.5" fill="#1d4ed8" />
      <circle cx="9" cy="11" r="1.8" fill="#fff" />
      <circle cx="15" cy="11" r="1.8" fill="#fff" />
      <rect x="9" y="14.3" width="6" height="1.3" rx="0.65" fill="#bfdbfe" />
      <rect x="1.8" y="9.5" width="2.2" height="4" rx="1" fill="#3b82f6" />
      <rect x="20" y="9.5" width="2.2" height="4" rx="1" fill="#3b82f6" />
      <rect x="7.5" y="18.5" width="9" height="3" rx="1.2" fill="#3b82f6" />
    </svg>
  );
}
