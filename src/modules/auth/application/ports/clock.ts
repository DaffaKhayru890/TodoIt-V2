/**
 * Re-export port waktu bersama. Modul auth tetap memakai path ini agar
 * kompatibilitas import Phase 2 tidak berubah, sementara implementasi tunggal
 * berada di shared domain supaya modul lain tidak bergantung pada modul auth.
 */
export { systemClock, type Clock } from '../../../../shared/domain/clock';
