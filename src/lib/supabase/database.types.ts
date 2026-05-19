export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_log_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      availability_email_attachments: {
        Row: {
          content_base64: string | null
          content_disposition: string | null
          content_type: string
          created_at: string
          download_error: string | null
          download_status: string
          filename: string
          id: string
          intake_id: string
          ocr_error: string | null
          ocr_model: string | null
          ocr_status: string
          ocr_text: string | null
          provider_attachment_id: string
          size_bytes: number | null
        }
        Insert: {
          content_base64?: string | null
          content_disposition?: string | null
          content_type: string
          created_at?: string
          download_error?: string | null
          download_status?: string
          filename: string
          id?: string
          intake_id: string
          ocr_error?: string | null
          ocr_model?: string | null
          ocr_status?: string
          ocr_text?: string | null
          provider_attachment_id: string
          size_bytes?: number | null
        }
        Update: {
          content_base64?: string | null
          content_disposition?: string | null
          content_type?: string
          created_at?: string
          download_error?: string | null
          download_status?: string
          filename?: string
          id?: string
          intake_id?: string
          ocr_error?: string | null
          ocr_model?: string | null
          ocr_status?: string
          ocr_text?: string | null
          provider_attachment_id?: string
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'availability_email_attachments_intake_id_fkey'
            columns: ['intake_id']
            isOneToOne: false
            referencedRelation: 'availability_email_intakes'
            referencedColumns: ['id']
          },
        ]
      }
      availability_email_intake_items: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          apply_error: string | null
          apply_method: string | null
          attachment_id: string | null
          auto_applied_at: string | null
          auto_applied_by: string | null
          confidence_level: string
          confidence_reasons: Json
          created_at: string
          employee_match_candidates: Json
          extracted_employee_name: string | null
          id: string
          intake_id: string
          manually_edited_at: string | null
          matched_cycle_id: string | null
          matched_therapist_id: string | null
          ocr_error: string | null
          ocr_model: string | null
          ocr_status: string
          original_parsed_requests: Json | null
          parse_status: string
          parsed_requests: Json
          raw_text: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_label: string
          source_type: string
          unresolved_lines: Json
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          apply_error?: string | null
          apply_method?: string | null
          attachment_id?: string | null
          auto_applied_at?: string | null
          auto_applied_by?: string | null
          confidence_level?: string
          confidence_reasons?: Json
          created_at?: string
          employee_match_candidates?: Json
          extracted_employee_name?: string | null
          id?: string
          intake_id: string
          manually_edited_at?: string | null
          matched_cycle_id?: string | null
          matched_therapist_id?: string | null
          ocr_error?: string | null
          ocr_model?: string | null
          ocr_status?: string
          original_parsed_requests?: Json | null
          parse_status?: string
          parsed_requests?: Json
          raw_text?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_label: string
          source_type: string
          unresolved_lines?: Json
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          apply_error?: string | null
          apply_method?: string | null
          attachment_id?: string | null
          auto_applied_at?: string | null
          auto_applied_by?: string | null
          confidence_level?: string
          confidence_reasons?: Json
          created_at?: string
          employee_match_candidates?: Json
          extracted_employee_name?: string | null
          id?: string
          intake_id?: string
          manually_edited_at?: string | null
          matched_cycle_id?: string | null
          matched_therapist_id?: string | null
          ocr_error?: string | null
          ocr_model?: string | null
          ocr_status?: string
          original_parsed_requests?: Json | null
          parse_status?: string
          parsed_requests?: Json
          raw_text?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_label?: string
          source_type?: string
          unresolved_lines?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'availability_email_intake_items_applied_by_fkey'
            columns: ['applied_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_email_intake_items_attachment_id_fkey'
            columns: ['attachment_id']
            isOneToOne: false
            referencedRelation: 'availability_email_attachments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_email_intake_items_auto_applied_by_fkey'
            columns: ['auto_applied_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_email_intake_items_intake_id_fkey'
            columns: ['intake_id']
            isOneToOne: false
            referencedRelation: 'availability_email_intakes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_email_intake_items_matched_cycle_id_fkey'
            columns: ['matched_cycle_id']
            isOneToOne: false
            referencedRelation: 'schedule_cycles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_email_intake_items_matched_therapist_id_fkey'
            columns: ['matched_therapist_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_email_intake_items_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      availability_email_intakes: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          auto_applied_count: number
          batch_status: string
          created_at: string
          failed_count: number
          from_email: string
          from_name: string | null
          html_content: string | null
          id: string
          item_count: number
          matched_cycle_id: string | null
          matched_therapist_id: string | null
          needs_review_count: number
          parse_status: string
          parse_summary: string | null
          parsed_requests: Json
          provider: string
          provider_email_id: string
          provider_message_id: string | null
          raw_payload: Json
          received_at: string
          subject: string | null
          text_content: string | null
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          auto_applied_count?: number
          batch_status?: string
          created_at?: string
          failed_count?: number
          from_email: string
          from_name?: string | null
          html_content?: string | null
          id?: string
          item_count?: number
          matched_cycle_id?: string | null
          matched_therapist_id?: string | null
          needs_review_count?: number
          parse_status?: string
          parse_summary?: string | null
          parsed_requests?: Json
          provider?: string
          provider_email_id: string
          provider_message_id?: string | null
          raw_payload?: Json
          received_at: string
          subject?: string | null
          text_content?: string | null
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          auto_applied_count?: number
          batch_status?: string
          created_at?: string
          failed_count?: number
          from_email?: string
          from_name?: string | null
          html_content?: string | null
          id?: string
          item_count?: number
          matched_cycle_id?: string | null
          matched_therapist_id?: string | null
          needs_review_count?: number
          parse_status?: string
          parse_summary?: string | null
          parsed_requests?: Json
          provider?: string
          provider_email_id?: string
          provider_message_id?: string | null
          raw_payload?: Json
          received_at?: string
          subject?: string | null
          text_content?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'availability_email_intakes_applied_by_fkey'
            columns: ['applied_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_email_intakes_matched_cycle_id_fkey'
            columns: ['matched_cycle_id']
            isOneToOne: false
            referencedRelation: 'schedule_cycles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_email_intakes_matched_therapist_id_fkey'
            columns: ['matched_therapist_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      availability_entries: {
        Row: {
          created_at: string
          created_by: string
          cycle_id: string
          date: string
          entry_type: Database['public']['Enums']['availability_entry_type']
          id: string
          reason: string | null
          shift_type: Database['public']['Enums']['availability_shift_type']
          therapist_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          cycle_id: string
          date: string
          entry_type: Database['public']['Enums']['availability_entry_type']
          id?: string
          reason?: string | null
          shift_type?: Database['public']['Enums']['availability_shift_type']
          therapist_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          cycle_id?: string
          date?: string
          entry_type?: Database['public']['Enums']['availability_entry_type']
          id?: string
          reason?: string | null
          shift_type?: Database['public']['Enums']['availability_shift_type']
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'availability_entries_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_entries_cycle_id_fkey'
            columns: ['cycle_id']
            isOneToOne: false
            referencedRelation: 'schedule_cycles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_entries_therapist_id_fkey'
            columns: ['therapist_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      availability_overrides: {
        Row: {
          created_at: string
          created_by: string
          cycle_id: string
          date: string
          id: string
          intent: string
          note: string | null
          override_type: string
          shift_type: string
          source: string
          source_intake_id: string | null
          source_intake_item_id: string | null
          therapist_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          cycle_id: string
          date: string
          id?: string
          intent: string
          note?: string | null
          override_type: string
          shift_type?: string
          source?: string
          source_intake_id?: string | null
          source_intake_item_id?: string | null
          therapist_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          cycle_id?: string
          date?: string
          id?: string
          intent?: string
          note?: string | null
          override_type?: string
          shift_type?: string
          source?: string
          source_intake_id?: string | null
          source_intake_item_id?: string | null
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'availability_overrides_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_overrides_cycle_id_fkey'
            columns: ['cycle_id']
            isOneToOne: false
            referencedRelation: 'schedule_cycles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_overrides_source_intake_id_fkey'
            columns: ['source_intake_id']
            isOneToOne: false
            referencedRelation: 'availability_email_intakes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_overrides_source_intake_item_id_fkey'
            columns: ['source_intake_item_id']
            isOneToOne: false
            referencedRelation: 'availability_email_intake_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_overrides_therapist_id_fkey'
            columns: ['therapist_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      availability_requests: {
        Row: {
          created_at: string
          cycle_id: string | null
          date: string
          id: string
          reason: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          cycle_id?: string | null
          date: string
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          cycle_id?: string | null
          date?: string
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'availability_requests_cycle_id_fkey'
            columns: ['cycle_id']
            isOneToOne: false
            referencedRelation: 'schedule_cycles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_requests_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      cycle_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          shift_data: Json
          site_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          shift_data: Json
          site_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          shift_data?: Json
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cycle_templates_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cycle_templates_site_id_fkey'
            columns: ['site_id']
            isOneToOne: false
            referencedRelation: 'sites'
            referencedColumns: ['id']
          },
        ]
      }
      employee_roster: {
        Row: {
          created_at: string
          created_by: string | null
          employment_type: string
          full_name: string
          id: string
          is_active: boolean
          is_lead_eligible: boolean
          matched_at: string | null
          matched_email: string | null
          matched_profile_id: string | null
          max_work_days_per_week: number
          normalized_full_name: string
          phone_number: string | null
          role: string
          shift_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employment_type?: string
          full_name: string
          id?: string
          is_active?: boolean
          is_lead_eligible?: boolean
          matched_at?: string | null
          matched_email?: string | null
          matched_profile_id?: string | null
          max_work_days_per_week?: number
          normalized_full_name: string
          phone_number?: string | null
          role: string
          shift_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employment_type?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_lead_eligible?: boolean
          matched_at?: string | null
          matched_email?: string | null
          matched_profile_id?: string | null
          max_work_days_per_week?: number
          normalized_full_name?: string
          phone_number?: string | null
          role?: string
          shift_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'employee_roster_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'employee_roster_matched_profile_id_fkey'
            columns: ['matched_profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'employee_roster_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      lottery_decisions: {
        Row: {
          applied_actions: Json
          applied_at: string
          applied_by: string
          context_signature: string
          id: string
          keep_to_work: number
          override_applied: boolean
          recommended_actions: Json
          reductions_needed: number
          scheduled_count: number
          shift_date: string
          shift_type: string
          site_id: string
          superseded_at: string | null
          superseded_by: string | null
        }
        Insert: {
          applied_actions?: Json
          applied_at?: string
          applied_by: string
          context_signature: string
          id?: string
          keep_to_work: number
          override_applied?: boolean
          recommended_actions?: Json
          reductions_needed: number
          scheduled_count: number
          shift_date: string
          shift_type: string
          site_id: string
          superseded_at?: string | null
          superseded_by?: string | null
        }
        Update: {
          applied_actions?: Json
          applied_at?: string
          applied_by?: string
          context_signature?: string
          id?: string
          keep_to_work?: number
          override_applied?: boolean
          recommended_actions?: Json
          reductions_needed?: number
          scheduled_count?: number
          shift_date?: string
          shift_type?: string
          site_id?: string
          superseded_at?: string | null
          superseded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'lottery_decisions_applied_by_fkey'
            columns: ['applied_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lottery_decisions_site_id_fkey'
            columns: ['site_id']
            isOneToOne: false
            referencedRelation: 'sites'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lottery_decisions_superseded_by_fkey'
            columns: ['superseded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      lottery_history_entries: {
        Row: {
          applied_status: Database['public']['Enums']['assignment_status']
          created_at: string
          created_by: string
          decision_id: string | null
          id: string
          invalidated_at: string | null
          invalidated_by: string | null
          invalidated_reason: string | null
          override_applied: boolean
          request_restored: boolean
          shift_date: string
          shift_id: string
          shift_type: string
          site_id: string
          therapist_id: string
        }
        Insert: {
          applied_status: Database['public']['Enums']['assignment_status']
          created_at?: string
          created_by: string
          decision_id?: string | null
          id?: string
          invalidated_at?: string | null
          invalidated_by?: string | null
          invalidated_reason?: string | null
          override_applied?: boolean
          request_restored?: boolean
          shift_date: string
          shift_id: string
          shift_type: string
          site_id: string
          therapist_id: string
        }
        Update: {
          applied_status?: Database['public']['Enums']['assignment_status']
          created_at?: string
          created_by?: string
          decision_id?: string | null
          id?: string
          invalidated_at?: string | null
          invalidated_by?: string | null
          invalidated_reason?: string | null
          override_applied?: boolean
          request_restored?: boolean
          shift_date?: string
          shift_id?: string
          shift_type?: string
          site_id?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lottery_history_entries_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lottery_history_entries_decision_id_fkey'
            columns: ['decision_id']
            isOneToOne: false
            referencedRelation: 'lottery_decisions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lottery_history_entries_invalidated_by_fkey'
            columns: ['invalidated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lottery_history_entries_shift_id_fkey'
            columns: ['shift_id']
            isOneToOne: false
            referencedRelation: 'shifts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lottery_history_entries_site_id_fkey'
            columns: ['site_id']
            isOneToOne: false
            referencedRelation: 'sites'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lottery_history_entries_therapist_id_fkey'
            columns: ['therapist_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      lottery_list_entries: {
        Row: {
          created_at: string
          created_by: string
          display_order: number
          id: string
          shift_type: string
          site_id: string
          therapist_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          created_by: string
          display_order: number
          id?: string
          shift_type: string
          site_id: string
          therapist_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          created_by?: string
          display_order?: number
          id?: string
          shift_type?: string
          site_id?: string
          therapist_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lottery_list_entries_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lottery_list_entries_site_id_fkey'
            columns: ['site_id']
            isOneToOne: false
            referencedRelation: 'sites'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lottery_list_entries_therapist_id_fkey'
            columns: ['therapist_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lottery_list_entries_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      lottery_requests: {
        Row: {
          created_at: string
          created_by: string
          id: string
          requested_at: string
          restored_at: string | null
          restored_by: string | null
          shift_date: string
          shift_type: string
          site_id: string
          state: string
          suppressed_at: string | null
          suppressed_by: string | null
          therapist_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          requested_at: string
          restored_at?: string | null
          restored_by?: string | null
          shift_date: string
          shift_type: string
          site_id: string
          state: string
          suppressed_at?: string | null
          suppressed_by?: string | null
          therapist_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          requested_at?: string
          restored_at?: string | null
          restored_by?: string | null
          shift_date?: string
          shift_type?: string
          site_id?: string
          state?: string
          suppressed_at?: string | null
          suppressed_by?: string | null
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lottery_requests_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lottery_requests_restored_by_fkey'
            columns: ['restored_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lottery_requests_site_id_fkey'
            columns: ['site_id']
            isOneToOne: false
            referencedRelation: 'sites'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lottery_requests_suppressed_by_fkey'
            columns: ['suppressed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lottery_requests_therapist_id_fkey'
            columns: ['therapist_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempt_count: number
          channel: string
          created_at: string
          email: string
          id: string
          last_error: string | null
          name: string | null
          publish_event_id: string
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          attempt_count?: number
          channel?: string
          created_at?: string
          email: string
          id?: string
          last_error?: string | null
          name?: string | null
          publish_event_id: string
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          attempt_count?: number
          channel?: string
          created_at?: string
          email?: string
          id?: string
          last_error?: string | null
          name?: string | null
          publish_event_id?: string
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'notification_outbox_publish_event_id_fkey'
            columns: ['publish_event_id']
            isOneToOne: false
            referencedRelation: 'publish_events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notification_outbox_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message: string
          read_at: string | null
          target_id: string | null
          target_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message: string
          read_at?: string | null
          target_id?: string | null
          target_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message?: string
          read_at?: string | null
          target_id?: string | null
          target_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      preliminary_cell_marks: {
        Row: {
          created_at: string
          date: string
          decision_note: string | null
          group_id: string | null
          id: string
          mark_type: string
          note: string | null
          requested_role: Database['public']['Enums']['shift_role']
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          shift_id: string | null
          shift_type: string
          snapshot_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          decision_note?: string | null
          group_id?: string | null
          id?: string
          mark_type: string
          note?: string | null
          requested_role?: Database['public']['Enums']['shift_role']
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_id?: string | null
          shift_type: string
          snapshot_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          decision_note?: string | null
          group_id?: string | null
          id?: string
          mark_type?: string
          note?: string | null
          requested_role?: Database['public']['Enums']['shift_role']
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_id?: string | null
          shift_type?: string
          snapshot_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'preliminary_cell_marks_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'preliminary_mark_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'preliminary_cell_marks_requester_id_fkey'
            columns: ['requester_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'preliminary_cell_marks_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'preliminary_cell_marks_shift_id_fkey'
            columns: ['shift_id']
            isOneToOne: false
            referencedRelation: 'shifts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'preliminary_cell_marks_snapshot_id_fkey'
            columns: ['snapshot_id']
            isOneToOne: false
            referencedRelation: 'preliminary_snapshots'
            referencedColumns: ['id']
          },
        ]
      }
      preliminary_mark_groups: {
        Row: {
          created_at: string
          decision_note: string | null
          id: string
          note: string | null
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          snapshot_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision_note?: string | null
          id?: string
          note?: string | null
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          snapshot_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision_note?: string | null
          id?: string
          note?: string | null
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          snapshot_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'preliminary_mark_groups_requester_id_fkey'
            columns: ['requester_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'preliminary_mark_groups_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'preliminary_mark_groups_snapshot_id_fkey'
            columns: ['snapshot_id']
            isOneToOne: false
            referencedRelation: 'preliminary_snapshots'
            referencedColumns: ['id']
          },
        ]
      }
      preliminary_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          decision_note: string | null
          id: string
          note: string | null
          requester_id: string
          shift_id: string
          snapshot_id: string
          status: string
          type: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          decision_note?: string | null
          id?: string
          note?: string | null
          requester_id: string
          shift_id: string
          snapshot_id: string
          status: string
          type: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          decision_note?: string | null
          id?: string
          note?: string | null
          requester_id?: string
          shift_id?: string
          snapshot_id?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'preliminary_requests_approved_by_fkey'
            columns: ['approved_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'preliminary_requests_requester_id_fkey'
            columns: ['requester_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'preliminary_requests_shift_id_fkey'
            columns: ['shift_id']
            isOneToOne: false
            referencedRelation: 'shifts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'preliminary_requests_snapshot_id_fkey'
            columns: ['snapshot_id']
            isOneToOne: false
            referencedRelation: 'preliminary_snapshots'
            referencedColumns: ['id']
          },
        ]
      }
      preliminary_shift_states: {
        Row: {
          active_request_id: string | null
          id: string
          reserved_by: string | null
          shift_id: string
          snapshot_id: string
          state: string
          updated_at: string
        }
        Insert: {
          active_request_id?: string | null
          id?: string
          reserved_by?: string | null
          shift_id: string
          snapshot_id: string
          state: string
          updated_at?: string
        }
        Update: {
          active_request_id?: string | null
          id?: string
          reserved_by?: string | null
          shift_id?: string
          snapshot_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'preliminary_shift_states_active_request_id_fkey'
            columns: ['active_request_id']
            isOneToOne: false
            referencedRelation: 'preliminary_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'preliminary_shift_states_reserved_by_fkey'
            columns: ['reserved_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'preliminary_shift_states_shift_id_fkey'
            columns: ['shift_id']
            isOneToOne: false
            referencedRelation: 'shifts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'preliminary_shift_states_snapshot_id_fkey'
            columns: ['snapshot_id']
            isOneToOne: false
            referencedRelation: 'preliminary_snapshots'
            referencedColumns: ['id']
          },
        ]
      }
      preliminary_snapshots: {
        Row: {
          created_at: string
          created_by: string
          cycle_id: string
          id: string
          sent_at: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          cycle_id: string
          id?: string
          sent_at?: string
          status: string
        }
        Update: {
          created_at?: string
          created_by?: string
          cycle_id?: string
          id?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'preliminary_snapshots_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'preliminary_snapshots_cycle_id_fkey'
            columns: ['cycle_id']
            isOneToOne: false
            referencedRelation: 'schedule_cycles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          access_status: Database['public']['Enums']['profile_access_status']
          archived_at: string | null
          archived_by: string | null
          created_at: string
          default_calendar_view: string
          default_landing_page: string
          default_schedule_view: string
          email: string
          employment_type: string
          fmla_return_date: string | null
          full_name: string
          id: string
          is_active: boolean
          is_lead_eligible: boolean
          max_consecutive_days: number
          max_work_days_per_week: number
          notification_email_enabled: boolean
          notification_in_app_enabled: boolean
          on_fmla: boolean
          phone_number: string | null
          preferred_work_days: number[]
          preferred_work_days_mode: string
          role: string
          shift_type: string
          site_id: string
          staff_onboarding_completed_at: string | null
          staff_onboarding_preferences_confirmed_at: string | null
          staff_onboarding_required: boolean
          staff_onboarding_theme_confirmed_at: string | null
        }
        Insert: {
          access_status?: Database['public']['Enums']['profile_access_status']
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          default_calendar_view?: string
          default_landing_page?: string
          default_schedule_view?: string
          email: string
          employment_type?: string
          fmla_return_date?: string | null
          full_name: string
          id: string
          is_active?: boolean
          is_lead_eligible?: boolean
          max_consecutive_days?: number
          max_work_days_per_week?: number
          notification_email_enabled?: boolean
          notification_in_app_enabled?: boolean
          on_fmla?: boolean
          phone_number?: string | null
          preferred_work_days?: number[]
          preferred_work_days_mode?: string
          role?: string
          shift_type?: string
          site_id?: string
          staff_onboarding_completed_at?: string | null
          staff_onboarding_preferences_confirmed_at?: string | null
          staff_onboarding_required?: boolean
          staff_onboarding_theme_confirmed_at?: string | null
        }
        Update: {
          access_status?: Database['public']['Enums']['profile_access_status']
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          default_calendar_view?: string
          default_landing_page?: string
          default_schedule_view?: string
          email?: string
          employment_type?: string
          fmla_return_date?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_lead_eligible?: boolean
          max_consecutive_days?: number
          max_work_days_per_week?: number
          notification_email_enabled?: boolean
          notification_in_app_enabled?: boolean
          on_fmla?: boolean
          phone_number?: string | null
          preferred_work_days?: number[]
          preferred_work_days_mode?: string
          role?: string
          shift_type?: string
          site_id?: string
          staff_onboarding_completed_at?: string | null
          staff_onboarding_preferences_confirmed_at?: string | null
          staff_onboarding_required?: boolean
          staff_onboarding_theme_confirmed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_archived_by_fkey'
            columns: ['archived_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'profiles_site_id_fkey'
            columns: ['site_id']
            isOneToOne: false
            referencedRelation: 'sites'
            referencedColumns: ['id']
          },
        ]
      }
      publish_events: {
        Row: {
          channel: string
          cycle_id: string
          error_message: string | null
          failed_count: number
          id: string
          published_at: string
          published_by: string
          queued_count: number
          recipient_count: number
          sent_count: number
          status: string
        }
        Insert: {
          channel?: string
          cycle_id: string
          error_message?: string | null
          failed_count?: number
          id?: string
          published_at?: string
          published_by: string
          queued_count?: number
          recipient_count?: number
          sent_count?: number
          status?: string
        }
        Update: {
          channel?: string
          cycle_id?: string
          error_message?: string | null
          failed_count?: number
          id?: string
          published_at?: string
          published_by?: string
          queued_count?: number
          recipient_count?: number
          sent_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'publish_events_cycle_id_fkey'
            columns: ['cycle_id']
            isOneToOne: false
            referencedRelation: 'schedule_cycles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'publish_events_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      resend_webhook_receipts: {
        Row: {
          email_id: string | null
          event_type: string
          processed_at: string | null
          received_at: string
          svix_id: string
        }
        Insert: {
          email_id?: string | null
          event_type: string
          processed_at?: string | null
          received_at?: string
          svix_id: string
        }
        Update: {
          email_id?: string | null
          event_type?: string
          processed_at?: string | null
          received_at?: string
          svix_id?: string
        }
        Relationships: []
      }
      schedule_cycles: {
        Row: {
          archived_at: string | null
          availability_closed_at: string | null
          availability_closed_by: string | null
          availability_due_at: string | null
          availability_reopened_at: string | null
          availability_reopened_by: string | null
          created_at: string
          end_date: string
          id: string
          label: string
          offline_at: string | null
          offline_by: string | null
          final_publish_target_date: string | null
          preliminary_target_date: string | null
          published: boolean
          site_id: string
          start_date: string
          status: Database['public']['Enums']['schedule_cycle_status']
        }
        Insert: {
          archived_at?: string | null
          availability_closed_at?: string | null
          availability_closed_by?: string | null
          availability_due_at?: string | null
          availability_reopened_at?: string | null
          availability_reopened_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          label: string
          offline_at?: string | null
          offline_by?: string | null
          final_publish_target_date?: string | null
          preliminary_target_date?: string | null
          published?: boolean
          site_id?: string
          start_date: string
          status?: Database['public']['Enums']['schedule_cycle_status']
        }
        Update: {
          archived_at?: string | null
          availability_closed_at?: string | null
          availability_closed_by?: string | null
          availability_due_at?: string | null
          availability_reopened_at?: string | null
          availability_reopened_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          label?: string
          offline_at?: string | null
          offline_by?: string | null
          final_publish_target_date?: string | null
          preliminary_target_date?: string | null
          published?: boolean
          site_id?: string
          start_date?: string
          status?: Database['public']['Enums']['schedule_cycle_status']
        }
        Relationships: [
          {
            foreignKeyName: 'schedule_cycles_availability_closed_by_fkey'
            columns: ['availability_closed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'schedule_cycles_availability_reopened_by_fkey'
            columns: ['availability_reopened_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'schedule_cycles_offline_by_fkey'
            columns: ['offline_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'schedule_cycles_site_id_fkey'
            columns: ['site_id']
            isOneToOne: false
            referencedRelation: 'sites'
            referencedColumns: ['id']
          },
        ]
      }
      shift_operational_entries: {
        Row: {
          active: boolean
          code: Database['public']['Enums']['assignment_status']
          created_at: string
          created_by: string
          id: string
          left_early_time: string | null
          note: string | null
          replaced_at: string | null
          replaced_by: string | null
          shift_id: string
        }
        Insert: {
          active?: boolean
          code: Database['public']['Enums']['assignment_status']
          created_at?: string
          created_by: string
          id?: string
          left_early_time?: string | null
          note?: string | null
          replaced_at?: string | null
          replaced_by?: string | null
          shift_id: string
        }
        Update: {
          active?: boolean
          code?: Database['public']['Enums']['assignment_status']
          created_at?: string
          created_by?: string
          id?: string
          left_early_time?: string | null
          note?: string | null
          replaced_at?: string | null
          replaced_by?: string | null
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shift_operational_entries_shift_id_fkey'
            columns: ['shift_id']
            isOneToOne: false
            referencedRelation: 'shifts'
            referencedColumns: ['id']
          },
        ]
      }
      shift_operational_entry_audit: {
        Row: {
          acted_at: string
          acted_by: string
          action_type: string
          code: Database['public']['Enums']['assignment_status']
          entry_id: string | null
          id: string
          left_early_time: string | null
          note: string | null
          shift_id: string
        }
        Insert: {
          acted_at?: string
          acted_by: string
          action_type: string
          code: Database['public']['Enums']['assignment_status']
          entry_id?: string | null
          id?: string
          left_early_time?: string | null
          note?: string | null
          shift_id: string
        }
        Update: {
          acted_at?: string
          acted_by?: string
          action_type?: string
          code?: Database['public']['Enums']['assignment_status']
          entry_id?: string | null
          id?: string
          left_early_time?: string | null
          note?: string | null
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shift_operational_entry_audit_entry_id_fkey'
            columns: ['entry_id']
            isOneToOne: false
            referencedRelation: 'shift_operational_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shift_operational_entry_audit_shift_id_fkey'
            columns: ['shift_id']
            isOneToOne: false
            referencedRelation: 'shifts'
            referencedColumns: ['id']
          },
        ]
      }
      shift_post_interests: {
        Row: {
          created_at: string
          id: string
          responded_at: string | null
          shift_post_id: string
          status: string
          therapist_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          responded_at?: string | null
          shift_post_id: string
          status?: string
          therapist_id: string
        }
        Update: {
          created_at?: string
          id?: string
          responded_at?: string | null
          shift_post_id?: string
          status?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shift_post_interests_shift_post_id_fkey'
            columns: ['shift_post_id']
            isOneToOne: false
            referencedRelation: 'shift_posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shift_post_interests_therapist_id_fkey'
            columns: ['therapist_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      shift_posts: {
        Row: {
          claimed_by: string | null
          created_at: string
          expired_at: string | null
          id: string
          manager_override: boolean
          message: string
          override_reason: string | null
          posted_by: string | null
          recipient_responded_at: string | null
          recipient_response: string | null
          request_kind: string
          shift_id: string | null
          status: string
          swap_shift_id: string | null
          type: string
          visibility: string
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string
          expired_at?: string | null
          id?: string
          manager_override?: boolean
          message: string
          override_reason?: string | null
          posted_by?: string | null
          recipient_responded_at?: string | null
          recipient_response?: string | null
          request_kind?: string
          shift_id?: string | null
          status?: string
          swap_shift_id?: string | null
          type: string
          visibility?: string
        }
        Update: {
          claimed_by?: string | null
          created_at?: string
          expired_at?: string | null
          id?: string
          manager_override?: boolean
          message?: string
          override_reason?: string | null
          posted_by?: string | null
          recipient_responded_at?: string | null
          recipient_response?: string | null
          request_kind?: string
          shift_id?: string | null
          status?: string
          swap_shift_id?: string | null
          type?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shift_posts_claimed_by_fkey'
            columns: ['claimed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shift_posts_posted_by_fkey'
            columns: ['posted_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shift_posts_shift_id_fkey'
            columns: ['shift_id']
            isOneToOne: false
            referencedRelation: 'shifts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shift_posts_swap_shift_id_fkey'
            columns: ['swap_shift_id']
            isOneToOne: false
            referencedRelation: 'shifts'
            referencedColumns: ['id']
          },
        ]
      }
      shift_reminder_outbox: {
        Row: {
          attempt_count: number
          created_at: string
          email: string
          id: string
          last_error: string | null
          name: string | null
          remind_type: string
          send_after: string
          sent_at: string | null
          shift_id: string
          status: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          email: string
          id?: string
          last_error?: string | null
          name?: string | null
          remind_type: string
          send_after: string
          sent_at?: string | null
          shift_id: string
          status?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          email?: string
          id?: string
          last_error?: string | null
          name?: string | null
          remind_type?: string
          send_after?: string
          sent_at?: string | null
          shift_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shift_reminder_outbox_shift_id_fkey'
            columns: ['shift_id']
            isOneToOne: false
            referencedRelation: 'shifts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shift_reminder_outbox_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      shift_status_changes: {
        Row: {
          changed_at: string
          changed_by: string
          from_status: string
          id: string
          shift_id: string
          therapist_name: string
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          from_status: string
          id?: string
          shift_id: string
          therapist_name: string
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          from_status?: string
          id?: string
          shift_id?: string
          therapist_name?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shift_status_changes_shift_id_fkey'
            columns: ['shift_id']
            isOneToOne: false
            referencedRelation: 'shifts'
            referencedColumns: ['id']
          },
        ]
      }
      shifts: {
        Row: {
          assignment_status: Database['public']['Enums']['assignment_status']
          availability_override: boolean
          availability_override_at: string | null
          availability_override_by: string | null
          availability_override_reason: string | null
          created_at: string
          cycle_id: string | null
          date: string
          employment_type_at_assignment: string | null
          id: string
          lead_eligible_at_assignment: boolean | null
          left_early_time: string | null
          role: Database['public']['Enums']['shift_role']
          shift_type: string
          shift_type_at_assignment: string | null
          site_id: string
          status: string
          status_note: string | null
          status_updated_at: string | null
          status_updated_by: string | null
          unfilled_reason: string | null
          user_id: string | null
        }
        Insert: {
          assignment_status?: Database['public']['Enums']['assignment_status']
          availability_override?: boolean
          availability_override_at?: string | null
          availability_override_by?: string | null
          availability_override_reason?: string | null
          created_at?: string
          cycle_id?: string | null
          date: string
          employment_type_at_assignment?: string | null
          id?: string
          lead_eligible_at_assignment?: boolean | null
          left_early_time?: string | null
          role?: Database['public']['Enums']['shift_role']
          shift_type: string
          shift_type_at_assignment?: string | null
          site_id?: string
          status?: string
          status_note?: string | null
          status_updated_at?: string | null
          status_updated_by?: string | null
          unfilled_reason?: string | null
          user_id?: string | null
        }
        Update: {
          assignment_status?: Database['public']['Enums']['assignment_status']
          availability_override?: boolean
          availability_override_at?: string | null
          availability_override_by?: string | null
          availability_override_reason?: string | null
          created_at?: string
          cycle_id?: string | null
          date?: string
          employment_type_at_assignment?: string | null
          id?: string
          lead_eligible_at_assignment?: boolean | null
          left_early_time?: string | null
          role?: Database['public']['Enums']['shift_role']
          shift_type?: string
          shift_type_at_assignment?: string | null
          site_id?: string
          status?: string
          status_note?: string | null
          status_updated_at?: string | null
          status_updated_by?: string | null
          unfilled_reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'shifts_availability_override_by_fkey'
            columns: ['availability_override_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shifts_cycle_id_fkey'
            columns: ['cycle_id']
            isOneToOne: false
            referencedRelation: 'schedule_cycles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shifts_site_id_fkey'
            columns: ['site_id']
            isOneToOne: false
            referencedRelation: 'sites'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shifts_status_updated_by_fkey'
            columns: ['status_updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shifts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      therapist_availability_submissions: {
        Row: {
          created_at: string
          id: string
          last_edited_at: string
          schedule_cycle_id: string
          submitted_at: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_edited_at: string
          schedule_cycle_id: string
          submitted_at: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_edited_at?: string
          schedule_cycle_id?: string
          submitted_at?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'therapist_availability_submissions_schedule_cycle_id_fkey'
            columns: ['schedule_cycle_id']
            isOneToOne: false
            referencedRelation: 'schedule_cycles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'therapist_availability_submissions_therapist_id_fkey'
            columns: ['therapist_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      work_patterns: {
        Row: {
          created_at: string
          cycle_anchor_date: string | null
          cycle_segments: Json
          offs_dow: number[]
          pattern_type: string
          shift_preference: string
          therapist_id: string
          updated_at: string
          weekend_anchor_date: string | null
          weekend_rotation: string
          weekend_rule: string
          weekly_weekdays: number[]
          works_dow: number[]
          works_dow_mode: string
        }
        Insert: {
          created_at?: string
          cycle_anchor_date?: string | null
          cycle_segments?: Json
          offs_dow?: number[]
          pattern_type?: string
          shift_preference?: string
          therapist_id: string
          updated_at?: string
          weekend_anchor_date?: string | null
          weekend_rotation?: string
          weekend_rule?: string
          weekly_weekdays?: number[]
          works_dow?: number[]
          works_dow_mode?: string
        }
        Update: {
          created_at?: string
          cycle_anchor_date?: string | null
          cycle_segments?: Json
          offs_dow?: number[]
          pattern_type?: string
          shift_preference?: string
          therapist_id?: string
          updated_at?: string
          weekend_anchor_date?: string | null
          weekend_rotation?: string
          weekend_rule?: string
          weekly_weekdays?: number[]
          works_dow?: number[]
          works_dow_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: 'work_patterns_therapist_id_fkey'
            columns: ['therapist_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_assert_pickup_claimant_eligible: {
        Args: {
          p_allow_direct?: boolean
          p_claimant_id: string
          p_post_id: string
        }
        Returns: undefined
      }
      app_create_shift_post_request: {
        Args: {
          p_actor_id: string
          p_claimed_by: string | null
          p_message: string
          p_shift_id: string
          p_type: string
          p_visibility: string
        }
        Returns: {
          claimed_by: string | null
          created_at: string
          expired_at: string | null
          id: string
          manager_override: boolean
          message: string
          override_reason: string | null
          posted_by: string | null
          recipient_responded_at: string | null
          recipient_response: string | null
          request_kind: string
          shift_id: string | null
          status: string
          swap_shift_id: string | null
          type: string
          visibility: string
        }
        SetofOptions: {
          from: '*'
          to: 'shift_posts'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      app_cancel_preliminary_cell_mark: {
        Args: { p_actor_id: string; p_mark_id: string }
        Returns: {
          id: string
        }[]
      }
      app_create_preliminary_cell_mark: {
        Args: {
          p_actor_id: string
          p_group_id?: string | null
          p_mark_date: string
          p_mark_type: string
          p_note?: string | null
          p_shift_id?: string | null
          p_shift_type: string
          p_snapshot_id: string
        }
        Returns: {
          group_id: string | null
          id: string
        }[]
      }
      app_create_preliminary_mark_group: {
        Args: { p_actor_id: string; p_note?: string | null; p_snapshot_id: string }
        Returns: {
          id: string
        }[]
      }
      app_delete_unpublished_cycle_shifts: {
        Args: {
          p_actor_id: string
          p_cycle_id: string
          p_unfilled_only?: boolean
        }
        Returns: number
      }
      app_deny_pickup_claimant: {
        Args: { p_actor_id: string; p_interest_id: string; p_post_id: string }
        Returns: {
          denied_interest_id: string
          promoted_interest_id: string
        }[]
      }
      app_express_shift_post_interest: {
        Args: { p_actor_id: string; p_post_id: string }
        Returns: {
          id: string
          status: string
        }[]
      }
      app_insert_unpublished_cycle_shifts: {
        Args: { p_actor_id: string; p_cycle_id: string; p_shifts: Json }
        Returns: {
          id: string
        }[]
      }
      app_promote_next_shift_post_interest: {
        Args: { p_post_id: string }
        Returns: string
      }
      app_publish_schedule_cycle: {
        Args: { p_actor_id: string; p_cycle_id: string }
        Returns: {
          id: string
        }[]
      }
      assert_schedule_cycle_availability_publish_ready: {
        Args: { p_cycle_id: string }
        Returns: undefined
      }
      app_take_schedule_cycle_offline: {
        Args: { p_actor_id: string; p_cycle_id: string }
        Returns: {
          id: string
        }[]
      }
      app_send_preliminary_schedule: {
        Args: { p_actor_id: string; p_cycle_id: string }
        Returns: {
          id: string
          label: string
          was_refresh: boolean
        }[]
      }
      app_start_schedule_cycle_over: {
        Args: { p_actor_id: string; p_cycle_id: string }
        Returns: {
          deleted_count: number
          id: string
        }[]
      }
      app_review_preliminary_cell_mark: {
        Args: {
          p_actor_id: string
          p_decision: string
          p_decision_note?: string | null
          p_mark_id: string
        }
        Returns: {
          id: string
          status: string
        }[]
      }
      app_respond_direct_shift_post: {
        Args: { p_actor_id: string; p_post_id: string; p_response: string }
        Returns: {
          claimed_by: string | null
          created_at: string
          expired_at: string | null
          id: string
          manager_override: boolean
          message: string
          override_reason: string | null
          posted_by: string | null
          recipient_responded_at: string | null
          recipient_response: string | null
          request_kind: string
          shift_id: string | null
          status: string
          swap_shift_id: string | null
          type: string
          visibility: string
        }
        SetofOptions: {
          from: '*'
          to: 'shift_posts'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      app_review_shift_post: {
        Args: {
          p_actor_id: string
          p_decision: string
          p_manager_override?: boolean
          p_override_reason?: string | null
          p_post_id: string
          p_selected_interest_id?: string | null
          p_swap_partner_id?: string | null
        }
        Returns: {
          claimed_by: string | null
          created_at: string
          expired_at: string | null
          id: string
          manager_override: boolean
          message: string
          override_reason: string | null
          posted_by: string | null
          recipient_responded_at: string | null
          recipient_response: string | null
          request_kind: string
          shift_id: string | null
          status: string
          swap_shift_id: string | null
          type: string
          visibility: string
        }
        SetofOptions: {
          from: '*'
          to: 'shift_posts'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      app_withdraw_shift_post: {
        Args: { p_actor_id: string; p_post_id: string }
        Returns: {
          claimed_by: string | null
          created_at: string
          expired_at: string | null
          id: string
          manager_override: boolean
          message: string
          override_reason: string | null
          posted_by: string | null
          recipient_responded_at: string | null
          recipient_response: string | null
          request_kind: string
          shift_id: string | null
          status: string
          swap_shift_id: string | null
          type: string
          visibility: string
        }
        SetofOptions: {
          from: '*'
          to: 'shift_posts'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      app_withdraw_shift_post_interest: {
        Args: { p_actor_id: string; p_interest_id: string }
        Returns: {
          promoted_interest_id: string
          shift_post_id: string
          withdrawn_interest_id: string
        }[]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      expire_unclaimed_swap_requests: { Args: never; Returns: number }
      find_invalid_shift_status_pairs: {
        Args: never
        Returns: {
          assignment_status: Database['public']['Enums']['assignment_status']
          shift_id: string
          status: string
        }[]
      }
      is_lead: { Args: never; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
      list_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobname: string
          schedule: string
        }[]
      }
      set_designated_shift_lead: {
        Args: {
          p_cycle_id: string
          p_shift_date: string
          p_shift_type: string
          p_therapist_id: string
        }
        Returns: undefined
      }
      update_assignment_status:
        | {
            Args: {
              p_actor_id: string
              p_assignment_id: string
              p_left_early_time?: string | null
              p_note?: string | null
              p_status: Database['public']['Enums']['assignment_status']
            }
            Returns: {
              assignment_status: Database['public']['Enums']['assignment_status']
              id: string
              left_early_time: string | null
              status_note: string | null
              status_updated_at: string
              status_updated_by: string | null
              status_updated_by_name: string | null
            }[]
          }
        | {
            Args: {
              p_assignment_id: string
              p_left_early_time?: string | null
              p_note?: string | null
              p_status: Database['public']['Enums']['assignment_status']
            }
            Returns: {
              assignment_status: Database['public']['Enums']['assignment_status']
              id: string
              left_early_time: string | null
              status_note: string | null
              status_updated_at: string
              status_updated_by: string | null
              status_updated_by_name: string | null
            }[]
          }
    }
    Enums: {
      assignment_status: 'scheduled' | 'call_in' | 'cancelled' | 'on_call' | 'left_early'
      availability_entry_type: 'unavailable' | 'available'
      availability_shift_type: 'day' | 'night' | 'both'
      profile_access_status: 'pending' | 'approved' | 'declined'
      schedule_cycle_status: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived'
      shift_role: 'lead' | 'staff'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      assignment_status: ['scheduled', 'call_in', 'cancelled', 'on_call', 'left_early'],
      availability_entry_type: ['unavailable', 'available'],
      availability_shift_type: ['day', 'night', 'both'],
      shift_role: ['lead', 'staff'],
    },
  },
} as const
