'use client'

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

type EmployeeLike = {
  id: string
  full_name: string
}

export function EmployeeDeactivateDialog({
  employee,
  onClose,
  setEmployeeActiveAction,
}: {
  employee: EmployeeLike | null
  onClose: () => void
  setEmployeeActiveAction: (formData: FormData) => void | Promise<void>
}) {
  return (
    <Dialog open={Boolean(employee)} onOpenChange={(open) => !open && onClose()}>
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
              <Button type="button" variant="outline" onClick={onClose}>
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
