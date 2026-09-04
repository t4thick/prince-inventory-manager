import { describe, expect, it } from 'vitest'
import { staffEmailForName } from './staff-login'

describe('staff sign-in name', () => {
  it('turns a first name into the private staff account identifier', () => {
    expect(staffEmailForName('  Kofi  ')).toBe('kofi@staff.princeamofahautos.com')
    expect(staffEmailForName("Osei-Kwaku")).toBe('osei-kwaku@staff.princeamofahautos.com')
  })

  it('keeps the owner email sign-in working', () => {
    expect(staffEmailForName('Owner@Example.com')).toBe('owner@example.com')
  })
})
