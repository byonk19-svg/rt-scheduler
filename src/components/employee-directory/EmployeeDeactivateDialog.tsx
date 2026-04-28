'use client'

import type { EmployeeDirectoryRecord } from '@/lib/employee-directory'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type EmployeeDeactivateDialogProps = {
  employee: EmployeeDirectoryRecord | null
  open: boolean
  setEmployeeActiveAction: (formData: FormData) => void | Promise<void>
  onOpenChange: (open: boolean) => void
}

export function EmployeeDeactivateDialog({
  employee,
  open,
  setEmployeeActiveAction,
  onOpenChange,
}: EmployeeDeactivateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate employee</DialogTitle>
          <DialogDescription>
            {employee
              ? `${employee.full_name} will be marked inactive and hidden by default.`
              : 'Confirm deactivation.'}
          </DialogDescription>
        </DialogHeader>
        {employee ? (
          <form action={setEmployeeActiveAction}>
            <input type="hidden" name="profile_id" value={employee.id} />
            <input type="hidden" name="set_active" value="false" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <FormSubmitButton type="submit" variant="destructive" pendingText="Deactivating...">
                Deactivate
              </FormSubmitButton>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
