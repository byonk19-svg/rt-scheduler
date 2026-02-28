// Core domain primitives shared across /coverage and /schedule pages.
// src/app/schedule/types.ts re-exports these for backward compatibility.

export type ShiftStatus = 'scheduled' | 'on_call' | 'sick' | 'called_off'
export type ShiftRole = 'lead' | 'staff'
export type AssignmentStatus = 'scheduled' | 'call_in' | 'cancelled' | 'on_call' | 'left_early'
export type EmploymentType = 'full_time' | 'part_time' | 'prn'
export type WeekendRotation = 'none' | 'every_other'
export type WorksDowMode = 'hard' | 'soft'
