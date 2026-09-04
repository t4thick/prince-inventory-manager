export function staffEmailForName(value: string) {
  const login = value.trim().toLocaleLowerCase('en').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  if (login.includes('@')) return login
  return `${login.replace(/[^a-z0-9'-]/g, '')}@staff.princeamofahautos.com`
}
