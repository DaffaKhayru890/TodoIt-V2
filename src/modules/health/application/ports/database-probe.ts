/**
 * Contract sisi Application: "bisakah dependensi database dihubungi?".
 * Implementasinya hidup di Infrastructure; Application tidak tahu ada pg/Drizzle.
 */
export interface DatabaseProbe {
  /** Menyelesaikan promise bila database merespons, menolak bila tidak. */
  probe(): Promise<void>;
}
