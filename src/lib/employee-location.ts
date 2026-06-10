export type EmployeeLocation = '办公室' | '车间';

export function isWorkshopDepartment(department?: string | null) {
  const normalizedDepartment = String(department || '').replace(/\s+/g, '');

  return (
    normalizedDepartment === '生产部' ||
    normalizedDepartment.startsWith('生产') ||
    normalizedDepartment.includes('车间')
  );
}

export function normalizeEmployeeLocation(location?: string | null): EmployeeLocation | null {
  const normalizedLocation = String(location || '').trim().toLowerCase();

  if (normalizedLocation === '车间' || normalizedLocation === 'workshop') return '车间';
  if (normalizedLocation === '办公室' || normalizedLocation === 'office') return '办公室';
  return null;
}

export function resolveEmployeeLocationByDepartment(department?: string | null): EmployeeLocation {
  if (isWorkshopDepartment(department)) return '车间';
  return '办公室';
}

export function resolveEmployeeSalaryLocation(
  department?: string | null,
  requestedLocation?: string | null,
): EmployeeLocation {
  if (isWorkshopDepartment(department)) return '车间';
  return normalizeEmployeeLocation(requestedLocation) || '办公室';
}
