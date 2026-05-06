/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          id: string
          user_id: string
          action: string
          target_type: string
          target_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          target_type: string
          target_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: string
          target_type?: string
          target_id?: string
          created_at?: string
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
          id: string
          intake_id: string
          provider_attachment_id: string
          filename: string
          content_type: string
          content_disposition: string | null
          size_bytes: number | null
          content_base64: string | null
          download_status: string
          download_error: string | null
          created_at: string
          ocr_status: string
          ocr_text: string | null
          ocr_model: string | null
          ocr_error: string | null
        }
        Insert: {
          id?: string
          intake_id: string
          provider_attachment_id: string
          filename: string
          content_type: string
          content_disposition?: string | null
          size_bytes?: number | null
          content_base64?: string | null
          download_status?: string
          download_error?: string | null
          created_at?: string
          ocr_status?: string
          ocr_text?: string | null
          ocr_model?: string | null
          ocr_error?: string | null
        }
        Update: {
          id?: string
          intake_id?: string
          provider_attachment_id?: string
          filename?: string
          content_type?: string
          content_disposition?: string | null
          size_bytes?: number | null
          content_base64?: string | null
          download_status?: string
          download_error?: string | null
          created_at?: string
          ocr_status?: string
          ocr_text?: string | null
          ocr_model?: string | null
          ocr_error?: string | null
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
          id: string
          intake_id: string
          source_type: string
          source_label: string
          attachment_id: string | null
          raw_text: string | null
          ocr_status: string
          ocr_model: string | null
          ocr_error: string | null
          parse_status: string
          confidence_level: string
          confidence_reasons: Json
          extracted_employee_name: string | null
          employee_match_candidates: Json
          matched_therapist_id: string | null
          matched_cycle_id: string | null
          parsed_requests: Json
          unresolved_lines: Json
          auto_applied_at: string | null
          auto_applied_by: string | null
          apply_error: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          created_at: string
          updated_at: string
          original_parsed_requests: Json | null
          manually_edited_at: string | null
        }
        Insert: {
          id?: string
          intake_id: string
          source_type: string
          source_label: string
          attachment_id?: string | null
          raw_text?: string | null
          ocr_status?: string
          ocr_model?: string | null
          ocr_error?: string | null
          parse_status?: string
          confidence_level?: string
          confidence_reasons?: Json
          extracted_employee_name?: string | null
          employee_match_candidates?: Json
          matched_therapist_id?: string | null
          matched_cycle_id?: string | null
          parsed_requests?: Json
          unresolved_lines?: Json
          auto_applied_at?: string | null
          auto_applied_by?: string | null
          apply_error?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          created_at?: string
          updated_at?: string
          original_parsed_requests?: Json | null
          manually_edited_at?: string | null
        }
        Update: {
          id?: string
          intake_id?: string
          source_type?: string
          source_label?: string
          attachment_id?: string | null
          raw_text?: string | null
          ocr_status?: string
          ocr_model?: string | null
          ocr_error?: string | null
          parse_status?: string
          confidence_level?: string
          confidence_reasons?: Json
          extracted_employee_name?: string | null
          employee_match_candidates?: Json
          matched_therapist_id?: string | null
          matched_cycle_id?: string | null
          parsed_requests?: Json
          unresolved_lines?: Json
          auto_applied_at?: string | null
          auto_applied_by?: string | null
          apply_error?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          created_at?: string
          updated_at?: string
          original_parsed_requests?: Json | null
          manually_edited_at?: string | null
        }
        Relationships: [
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
          id: string
          provider: string
          provider_email_id: string
          provider_message_id: string | null
          from_email: string
          from_name: string | null
          subject: string | null
          text_content: string | null
          html_content: string | null
          received_at: string
          matched_therapist_id: string | null
          matched_cycle_id: string | null
          parse_status: string
          parse_summary: string | null
          parsed_requests: Json
          raw_payload: Json
          applied_at: string | null
          applied_by: string | null
          created_at: string
          updated_at: string
          batch_status: string
          item_count: number
          auto_applied_count: number
          needs_review_count: number
          failed_count: number
        }
        Insert: {
          id?: string
          provider?: string
          provider_email_id: string
          provider_message_id?: string | null
          from_email: string
          from_name?: string | null
          subject?: string | null
          text_content?: string | null
          html_content?: string | null
          received_at: string
          matched_therapist_id?: string | null
          matched_cycle_id?: string | null
          parse_status?: string
          parse_summary?: string | null
          parsed_requests?: Json
          raw_payload?: Json
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string
          updated_at?: string
          batch_status?: string
          item_count?: number
          auto_applied_count?: number
          needs_review_count?: number
          failed_count?: number
        }
        Update: {
          id?: string
          provider?: string
          provider_email_id?: string
          provider_message_id?: string | null
          from_email?: string
          from_name?: string | null
          subject?: string | null
          text_content?: string | null
          html_content?: string | null
          received_at?: string
          matched_therapist_id?: string | null
          matched_cycle_id?: string | null
          parse_status?: string
          parse_summary?: string | null
          parsed_requests?: Json
          raw_payload?: Json
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string
          updated_at?: string
          batch_status?: string
          item_count?: number
          auto_applied_count?: number
          needs_review_count?: number
          failed_count?: number
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
          id: string
          therapist_id: string
          cycle_id: string
          date: string
          shift_type: Database['public']['Enums']['availability_shift_type']
          entry_type: Database['public']['Enums']['availability_entry_type']
          reason: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          therapist_id: string
          cycle_id: string
          date: string
          shift_type?: Database['public']['Enums']['availability_shift_type']
          entry_type: Database['public']['Enums']['availability_entry_type']
          reason?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          therapist_id?: string
          cycle_id?: string
          date?: string
          shift_type?: Database['public']['Enums']['availability_shift_type']
          entry_type?: Database['public']['Enums']['availability_entry_type']
          reason?: string | null
          created_by?: string
          created_at?: string
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
          id: string
          cycle_id: string
          therapist_id: string
          date: string
          shift_type: string
          override_type: string
          note: string | null
          created_by: string
          created_at: string
          source: string
          updated_at: string
          source_intake_id: string | null
          source_intake_item_id: string | null
        }
        Insert: {
          id?: string
          cycle_id: string
          therapist_id: string
          date: string
          shift_type?: string
          override_type: string
          note?: string | null
          created_by: string
          created_at?: string
          source?: string
          updated_at?: string
          source_intake_id?: string | null
          source_intake_item_id?: string | null
        }
        Update: {
          id?: string
          cycle_id?: string
          therapist_id?: string
          date?: string
          shift_type?: string
          override_type?: string
          note?: string | null
          created_by?: string
          created_at?: string
          source?: string
          updated_at?: string
          source_intake_id?: string | null
          source_intake_item_id?: string | null
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
          id: string
          user_id: string | null
          cycle_id: string | null
          date: string
          reason: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          cycle_id?: string | null
          date: string
          reason?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          cycle_id?: string | null
          date?: string
          reason?: string | null
          created_at?: string | null
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
      availability_reviews: {
        Row: {
          id: string
          therapist_id: string
          cycle_id: string
          status: string
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          therapist_id: string
          cycle_id: string
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          therapist_id?: string
          cycle_id?: string
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'availability_reviews_cycle_id_fkey'
            columns: ['cycle_id']
            isOneToOne: false
            referencedRelation: 'schedule_cycles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_reviews_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'availability_reviews_therapist_id_fkey'
            columns: ['therapist_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      cycle_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          created_by: string | null
          created_at: string
          site_id: string
          shift_data: Json
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_by?: string | null
          created_at?: string
          site_id?: string
          shift_data: Json
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_by?: string | null
          created_at?: string
          site_id?: string
          shift_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'cycle_templates_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      employee_roster: {
        Row: {
          id: string
          full_name: string
          normalized_full_name: string
          role: string
          shift_type: string
          employment_type: string
          max_work_days_per_week: number
          is_lead_eligible: boolean
          is_active: boolean
          matched_profile_id: string | null
          matched_email: string | null
          matched_at: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
          phone_number: string | null
        }
        Insert: {
          id?: string
          full_name: string
          normalized_full_name: string
          role: string
          shift_type?: string
          employment_type?: string
          max_work_days_per_week?: number
          is_lead_eligible?: boolean
          is_active?: boolean
          matched_profile_id?: string | null
          matched_email?: string | null
          matched_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
          phone_number?: string | null
        }
        Update: {
          id?: string
          full_name?: string
          normalized_full_name?: string
          role?: string
          shift_type?: string
          employment_type?: string
          max_work_days_per_week?: number
          is_lead_eligible?: boolean
          is_active?: boolean
          matched_profile_id?: string | null
          matched_email?: string | null
          matched_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
          phone_number?: string | null
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
          id: string
          site_id: string
          shift_date: string
          shift_type: string
          keep_to_work: number
          scheduled_count: number
          reductions_needed: number
          context_signature: string
          recommended_actions: Json
          applied_actions: Json
          override_applied: boolean
          applied_at: string
          applied_by: string
          superseded_at: string | null
          superseded_by: string | null
        }
        Insert: {
          id?: string
          site_id: string
          shift_date: string
          shift_type: string
          keep_to_work: number
          scheduled_count: number
          reductions_needed: number
          context_signature: string
          recommended_actions?: Json
          applied_actions?: Json
          override_applied?: boolean
          applied_at?: string
          applied_by: string
          superseded_at?: string | null
          superseded_by?: string | null
        }
        Update: {
          id?: string
          site_id?: string
          shift_date?: string
          shift_type?: string
          keep_to_work?: number
          scheduled_count?: number
          reductions_needed?: number
          context_signature?: string
          recommended_actions?: Json
          applied_actions?: Json
          override_applied?: boolean
          applied_at?: string
          applied_by?: string
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
          id: string
          site_id: string
          shift_id: string
          decision_id: string | null
          therapist_id: string
          shift_date: string
          shift_type: string
          applied_status: Database['public']['Enums']['assignment_status']
          created_at: string
          created_by: string
          invalidated_at: string | null
          invalidated_by: string | null
          invalidated_reason: string | null
          override_applied: boolean
          request_restored: boolean
        }
        Insert: {
          id?: string
          site_id: string
          shift_id: string
          decision_id?: string | null
          therapist_id: string
          shift_date: string
          shift_type: string
          applied_status: Database['public']['Enums']['assignment_status']
          created_at?: string
          created_by: string
          invalidated_at?: string | null
          invalidated_by?: string | null
          invalidated_reason?: string | null
          override_applied?: boolean
          request_restored?: boolean
        }
        Update: {
          id?: string
          site_id?: string
          shift_id?: string
          decision_id?: string | null
          therapist_id?: string
          shift_date?: string
          shift_type?: string
          applied_status?: Database['public']['Enums']['assignment_status']
          created_at?: string
          created_by?: string
          invalidated_at?: string | null
          invalidated_by?: string | null
          invalidated_reason?: string | null
          override_applied?: boolean
          request_restored?: boolean
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
          id: string
          site_id: string
          shift_type: string
          therapist_id: string
          display_order: number
          created_at: string
          created_by: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          id?: string
          site_id: string
          shift_type: string
          therapist_id: string
          display_order: number
          created_at?: string
          created_by: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          id?: string
          site_id?: string
          shift_type?: string
          therapist_id?: string
          display_order?: number
          created_at?: string
          created_by?: string
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
          id: string
          site_id: string
          therapist_id: string
          shift_date: string
          shift_type: string
          requested_at: string
          state: string
          created_at: string
          created_by: string
          suppressed_at: string | null
          suppressed_by: string | null
          restored_at: string | null
          restored_by: string | null
        }
        Insert: {
          id?: string
          site_id: string
          therapist_id: string
          shift_date: string
          shift_type: string
          requested_at: string
          state: string
          created_at?: string
          created_by: string
          suppressed_at?: string | null
          suppressed_by?: string | null
          restored_at?: string | null
          restored_by?: string | null
        }
        Update: {
          id?: string
          site_id?: string
          therapist_id?: string
          shift_date?: string
          shift_type?: string
          requested_at?: string
          state?: string
          created_at?: string
          created_by?: string
          suppressed_at?: string | null
          suppressed_by?: string | null
          restored_at?: string | null
          restored_by?: string | null
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
          id: string
          publish_event_id: string
          user_id: string | null
          email: string
          name: string | null
          channel: string
          status: string
          attempt_count: number
          last_error: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          publish_event_id: string
          user_id?: string | null
          email: string
          name?: string | null
          channel?: string
          status?: string
          attempt_count?: number
          last_error?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          publish_event_id?: string
          user_id?: string | null
          email?: string
          name?: string | null
          channel?: string
          status?: string
          attempt_count?: number
          last_error?: string | null
          sent_at?: string | null
          created_at?: string
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
          id: string
          user_id: string
          event_type: string
          title: string
          message: string
          target_type: string | null
          target_id: string | null
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          event_type: string
          title: string
          message: string
          target_type?: string | null
          target_id?: string | null
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          event_type?: string
          title?: string
          message?: string
          target_type?: string | null
          target_id?: string | null
          created_at?: string
          read_at?: string | null
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
      preliminary_requests: {
        Row: {
          id: string
          snapshot_id: string
          shift_id: string
          requester_id: string
          type: string
          status: string
          note: string | null
          decision_note: string | null
          approved_by: string | null
          approved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          snapshot_id: string
          shift_id: string
          requester_id: string
          type: string
          status: string
          note?: string | null
          decision_note?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          snapshot_id?: string
          shift_id?: string
          requester_id?: string
          type?: string
          status?: string
          note?: string | null
          decision_note?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
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
          id: string
          snapshot_id: string
          shift_id: string
          state: string
          reserved_by: string | null
          active_request_id: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          snapshot_id: string
          shift_id: string
          state: string
          reserved_by?: string | null
          active_request_id?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          snapshot_id?: string
          shift_id?: string
          state?: string
          reserved_by?: string | null
          active_request_id?: string | null
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
          id: string
          cycle_id: string
          created_by: string
          sent_at: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          cycle_id: string
          created_by: string
          sent_at?: string
          status: string
          created_at?: string
        }
        Update: {
          id?: string
          cycle_id?: string
          created_by?: string
          sent_at?: string
          status?: string
          created_at?: string
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
          id: string
          full_name: string
          email: string
          role: string | null
          shift_type: string
          created_at: string | null
          is_lead_eligible: boolean
          phone_number: string | null
          employment_type: string
          max_work_days_per_week: number
          on_fmla: boolean
          fmla_return_date: string | null
          is_active: boolean
          preferred_work_days: number[]
          default_calendar_view: string
          default_landing_page: string
          site_id: string
          archived_at: string | null
          archived_by: string | null
          default_schedule_view: string
          max_consecutive_days: number
          notification_in_app_enabled: boolean
          notification_email_enabled: boolean
          preferred_work_days_mode: string
          staff_onboarding_required: boolean
          staff_onboarding_preferences_confirmed_at: string | null
          staff_onboarding_theme_confirmed_at: string | null
          staff_onboarding_completed_at: string | null
        }
        Insert: {
          id: string
          full_name: string
          email: string
          role?: string | null
          shift_type?: string
          created_at?: string | null
          is_lead_eligible?: boolean
          phone_number?: string | null
          employment_type?: string
          max_work_days_per_week?: number
          on_fmla?: boolean
          fmla_return_date?: string | null
          is_active?: boolean
          preferred_work_days?: number[]
          default_calendar_view?: string
          default_landing_page?: string
          site_id?: string
          archived_at?: string | null
          archived_by?: string | null
          default_schedule_view?: string
          max_consecutive_days?: number
          notification_in_app_enabled?: boolean
          notification_email_enabled?: boolean
          preferred_work_days_mode?: string
          staff_onboarding_required?: boolean
          staff_onboarding_preferences_confirmed_at?: string | null
          staff_onboarding_theme_confirmed_at?: string | null
          staff_onboarding_completed_at?: string | null
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          role?: string | null
          shift_type?: string
          created_at?: string | null
          is_lead_eligible?: boolean
          phone_number?: string | null
          employment_type?: string
          max_work_days_per_week?: number
          on_fmla?: boolean
          fmla_return_date?: string | null
          is_active?: boolean
          preferred_work_days?: number[]
          default_calendar_view?: string
          default_landing_page?: string
          site_id?: string
          archived_at?: string | null
          archived_by?: string | null
          default_schedule_view?: string
          max_consecutive_days?: number
          notification_in_app_enabled?: boolean
          notification_email_enabled?: boolean
          preferred_work_days_mode?: string
          staff_onboarding_required?: boolean
          staff_onboarding_preferences_confirmed_at?: string | null
          staff_onboarding_theme_confirmed_at?: string | null
          staff_onboarding_completed_at?: string | null
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
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      publish_events: {
        Row: {
          id: string
          cycle_id: string
          published_at: string
          published_by: string
          status: string
          recipient_count: number
          channel: string
          queued_count: number
          sent_count: number
          failed_count: number
          error_message: string | null
        }
        Insert: {
          id?: string
          cycle_id: string
          published_at?: string
          published_by: string
          status?: string
          recipient_count?: number
          channel?: string
          queued_count?: number
          sent_count?: number
          failed_count?: number
          error_message?: string | null
        }
        Update: {
          id?: string
          cycle_id?: string
          published_at?: string
          published_by?: string
          status?: string
          recipient_count?: number
          channel?: string
          queued_count?: number
          sent_count?: number
          failed_count?: number
          error_message?: string | null
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
          svix_id: string
          event_type: string
          email_id: string | null
          received_at: string
          processed_at: string | null
        }
        Insert: {
          svix_id: string
          event_type: string
          email_id?: string | null
          received_at?: string
          processed_at?: string | null
        }
        Update: {
          svix_id?: string
          event_type?: string
          email_id?: string | null
          received_at?: string
          processed_at?: string | null
        }
        Relationships: []
      }
      schedule_cycles: {
        Row: {
          id: string
          label: string
          start_date: string
          end_date: string
          published: boolean | null
          created_at: string | null
          archived_at: string | null
          availability_due_at: string | null
          site_id: string
        }
        Insert: {
          id?: string
          label: string
          start_date: string
          end_date: string
          published?: boolean | null
          created_at?: string | null
          archived_at?: string | null
          availability_due_at?: string | null
          site_id?: string
        }
        Update: {
          id?: string
          label?: string
          start_date?: string
          end_date?: string
          published?: boolean | null
          created_at?: string | null
          archived_at?: string | null
          availability_due_at?: string | null
          site_id?: string
        }
        Relationships: []
      }
      shift_operational_entries: {
        Row: {
          id: string
          shift_id: string
          code: Database['public']['Enums']['assignment_status']
          note: string | null
          left_early_time: string | null
          active: boolean
          created_at: string
          created_by: string
          replaced_at: string | null
          replaced_by: string | null
        }
        Insert: {
          id?: string
          shift_id: string
          code: Database['public']['Enums']['assignment_status']
          note?: string | null
          left_early_time?: string | null
          active?: boolean
          created_at?: string
          created_by: string
          replaced_at?: string | null
          replaced_by?: string | null
        }
        Update: {
          id?: string
          shift_id?: string
          code?: Database['public']['Enums']['assignment_status']
          note?: string | null
          left_early_time?: string | null
          active?: boolean
          created_at?: string
          created_by?: string
          replaced_at?: string | null
          replaced_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'shift_operational_entries_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shift_operational_entries_replaced_by_fkey'
            columns: ['replaced_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
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
          id: string
          shift_id: string
          entry_id: string | null
          action_type: string
          code: Database['public']['Enums']['assignment_status']
          note: string | null
          left_early_time: string | null
          acted_by: string
          acted_at: string
        }
        Insert: {
          id?: string
          shift_id: string
          entry_id?: string | null
          action_type: string
          code: Database['public']['Enums']['assignment_status']
          note?: string | null
          left_early_time?: string | null
          acted_by: string
          acted_at?: string
        }
        Update: {
          id?: string
          shift_id?: string
          entry_id?: string | null
          action_type?: string
          code?: Database['public']['Enums']['assignment_status']
          note?: string | null
          left_early_time?: string | null
          acted_by?: string
          acted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shift_operational_entry_audit_acted_by_fkey'
            columns: ['acted_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
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
          id: string
          shift_post_id: string
          therapist_id: string
          status: string
          created_at: string
          responded_at: string | null
        }
        Insert: {
          id?: string
          shift_post_id: string
          therapist_id: string
          status?: string
          created_at?: string
          responded_at?: string | null
        }
        Update: {
          id?: string
          shift_post_id?: string
          therapist_id?: string
          status?: string
          created_at?: string
          responded_at?: string | null
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
          id: string
          shift_id: string | null
          posted_by: string | null
          message: string
          type: string
          status: string
          created_at: string | null
          claimed_by: string | null
          swap_shift_id: string | null
          expired_at: string | null
          manager_override: boolean
          override_reason: string | null
          visibility: string
          recipient_response: string | null
          recipient_responded_at: string | null
          request_kind: string
        }
        Insert: {
          id?: string
          shift_id?: string | null
          posted_by?: string | null
          message: string
          type: string
          status?: string
          created_at?: string | null
          claimed_by?: string | null
          swap_shift_id?: string | null
          expired_at?: string | null
          manager_override?: boolean
          override_reason?: string | null
          visibility?: string
          recipient_response?: string | null
          recipient_responded_at?: string | null
          request_kind?: string
        }
        Update: {
          id?: string
          shift_id?: string | null
          posted_by?: string | null
          message?: string
          type?: string
          status?: string
          created_at?: string | null
          claimed_by?: string | null
          swap_shift_id?: string | null
          expired_at?: string | null
          manager_override?: boolean
          override_reason?: string | null
          visibility?: string
          recipient_response?: string | null
          recipient_responded_at?: string | null
          request_kind?: string
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
          id: string
          user_id: string | null
          shift_id: string | null
          remind_type: string
          status: string
          email: string
          name: string | null
          attempt_count: number
          last_error: string | null
          send_after: string
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          shift_id?: string | null
          remind_type: string
          status?: string
          email: string
          name?: string | null
          attempt_count?: number
          last_error?: string | null
          send_after: string
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          shift_id?: string | null
          remind_type?: string
          status?: string
          email?: string
          name?: string | null
          attempt_count?: number
          last_error?: string | null
          send_after?: string
          sent_at?: string | null
          created_at?: string
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
          id: string
          shift_id: string
          therapist_name: string
          from_status: string
          to_status: string
          changed_at: string
          changed_by: string
        }
        Insert: {
          id?: string
          shift_id: string
          therapist_name: string
          from_status: string
          to_status: string
          changed_at?: string
          changed_by: string
        }
        Update: {
          id?: string
          shift_id?: string
          therapist_name?: string
          from_status?: string
          to_status?: string
          changed_at?: string
          changed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shift_status_changes_changed_by_fkey'
            columns: ['changed_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
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
          id: string
          cycle_id: string | null
          user_id: string | null
          date: string
          shift_type: string
          status: string
          created_at: string | null
          role: Database['public']['Enums']['shift_role']
          site_id: string
          assignment_status: Database['public']['Enums']['assignment_status']
          status_note: string | null
          left_early_time: string | null
          status_updated_at: string | null
          status_updated_by: string | null
          availability_override: boolean
          availability_override_reason: string | null
          availability_override_by: string | null
          availability_override_at: string | null
          unfilled_reason: string | null
        }
        Insert: {
          id?: string
          cycle_id?: string | null
          user_id?: string | null
          date: string
          shift_type: string
          status?: string
          created_at?: string | null
          role?: Database['public']['Enums']['shift_role']
          site_id?: string
          assignment_status?: Database['public']['Enums']['assignment_status']
          status_note?: string | null
          left_early_time?: string | null
          status_updated_at?: string | null
          status_updated_by?: string | null
          availability_override?: boolean
          availability_override_reason?: string | null
          availability_override_by?: string | null
          availability_override_at?: string | null
          unfilled_reason?: string | null
        }
        Update: {
          id?: string
          cycle_id?: string | null
          user_id?: string | null
          date?: string
          shift_type?: string
          status?: string
          created_at?: string | null
          role?: Database['public']['Enums']['shift_role']
          site_id?: string
          assignment_status?: Database['public']['Enums']['assignment_status']
          status_note?: string | null
          left_early_time?: string | null
          status_updated_at?: string | null
          status_updated_by?: string | null
          availability_override?: boolean
          availability_override_reason?: string | null
          availability_override_by?: string | null
          availability_override_at?: string | null
          unfilled_reason?: string | null
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
      therapist_availability_submissions: {
        Row: {
          id: string
          therapist_id: string
          schedule_cycle_id: string
          submitted_at: string
          last_edited_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          therapist_id: string
          schedule_cycle_id: string
          submitted_at: string
          last_edited_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          therapist_id?: string
          schedule_cycle_id?: string
          submitted_at?: string
          last_edited_at?: string
          created_at?: string
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
          therapist_id: string
          works_dow: number[]
          offs_dow: number[]
          weekend_rotation: string
          weekend_anchor_date: string | null
          works_dow_mode: string
          shift_preference: string
          created_at: string
          updated_at: string
          pattern_type: string
          weekly_weekdays: number[]
          weekend_rule: string
          cycle_anchor_date: string | null
          cycle_segments: Json
        }
        Insert: {
          therapist_id: string
          works_dow?: number[]
          offs_dow?: number[]
          weekend_rotation?: string
          weekend_anchor_date?: string | null
          works_dow_mode?: string
          shift_preference?: string
          created_at?: string
          updated_at?: string
          pattern_type?: string
          weekly_weekdays?: number[]
          weekend_rule?: string
          cycle_anchor_date?: string | null
          cycle_segments?: Json
        }
        Update: {
          therapist_id?: string
          works_dow?: number[]
          offs_dow?: number[]
          weekend_rotation?: string
          weekend_anchor_date?: string | null
          works_dow_mode?: string
          shift_preference?: string
          created_at?: string
          updated_at?: string
          pattern_type?: string
          weekly_weekdays?: number[]
          weekend_rule?: string
          cycle_anchor_date?: string | null
          cycle_segments?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'work_patterns_therapist_id_fkey'
            columns: ['therapist_id']
            isOneToOne: false
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
      app_create_shift_post_request: {
        Args: {
          p_actor_id: string
          p_shift_id: string
          p_type: string
          p_visibility: string
          p_claimed_by: string | null
          p_message: string
        }
        Returns: any
      }
      app_deny_pickup_claimant: {
        Args: {
          p_actor_id: string
          p_post_id: string
          p_interest_id: string
        }
        Returns: any
      }
      app_express_shift_post_interest: {
        Args: {
          p_actor_id: string
          p_post_id: string
        }
        Returns: Array<{
          id: string
          status: string
        }>
      }
      app_delete_unpublished_cycle_shifts: {
        Args: {
          p_actor_id: string
          p_cycle_id: string
          p_unfilled_only?: boolean
        }
        Returns: number
      }
      app_insert_unpublished_cycle_shifts: {
        Args: {
          p_actor_id: string
          p_cycle_id: string
          p_shifts: Json
        }
        Returns: Array<{
          id: string
        }>
      }
      app_respond_direct_shift_post: {
        Args: {
          p_actor_id: string
          p_post_id: string
          p_response: string
        }
        Returns: any
      }
      app_review_shift_post: {
        Args: {
          p_actor_id: string
          p_post_id: string
          p_decision: string
          p_selected_interest_id?: string | null
          p_swap_partner_id?: string | null
          p_manager_override?: boolean
          p_override_reason?: string | null
        }
        Returns: any
      }
      app_withdraw_shift_post: {
        Args: {
          p_actor_id: string
          p_post_id: string
        }
        Returns: any
      }
      app_withdraw_shift_post_interest: {
        Args: {
          p_actor_id: string
          p_interest_id: string
        }
        Returns: any
      }
      apply_approved_shift_post: {
        Args: {}
        Returns: any
      }
      custom_access_token_hook: {
        Args: {
          event: Json
        }
        Returns: any
      }
      deny_sibling_pickup_posts: {
        Args: {}
        Returns: any
      }
      enforce_shift_post_interest_parent_state: {
        Args: {}
        Returns: any
      }
      enforce_shift_post_status_transitions: {
        Args: {}
        Returns: any
      }
      expire_unclaimed_swap_requests: {
        Args: {}
        Returns: any
      }
      handle_new_user: {
        Args: {}
        Returns: any
      }
      is_lead: {
        Args: {}
        Returns: any
      }
      is_manager: {
        Args: {}
        Returns: any
      }
      list_cron_jobs: {
        Args: {}
        Returns: any
      }
      notify_on_shift_post_change: {
        Args: {}
        Returns: any
      }
      restrict_availability_override_cycle_updates: {
        Args: {}
        Returns: any
      }
      restrict_profile_staffing_field_updates: {
        Args: {}
        Returns: any
      }
      restrict_shift_availability_override_updates: {
        Args: {}
        Returns: any
      }
      set_designated_shift_lead: {
        Args: {
          p_cycle_id: string
          p_shift_date: string
          p_shift_type: string
          p_therapist_id: string
        }
        Returns: any
      }
      touch_availability_email_intake_items_updated_at: {
        Args: {}
        Returns: any
      }
      touch_availability_email_intakes_updated_at: {
        Args: {}
        Returns: any
      }
      touch_availability_overrides_updated_at: {
        Args: {}
        Returns: any
      }
      touch_employee_roster_updated_at: {
        Args: {}
        Returns: any
      }
      touch_therapist_availability_submissions_updated_at: {
        Args: {}
        Returns: any
      }
      touch_work_patterns_updated_at: {
        Args: {}
        Returns: any
      }
      update_assignment_status: {
        Args: {
          p_assignment_id: string
          p_status: Database['public']['Enums']['assignment_status']
          p_note?: string | null
          p_left_early_time?: string | null
        }
        Returns: any
      }
    }
    Enums: {
      assignment_status: 'scheduled' | 'call_in' | 'cancelled' | 'on_call' | 'left_early'
      availability_entry_type: 'unavailable' | 'available'
      availability_shift_type: 'day' | 'night' | 'both'
      shift_role: 'lead' | 'staff'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<TableName extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][TableName]['Row']
export type TablesInsert<TableName extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][TableName]['Insert']
export type TablesUpdate<TableName extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][TableName]['Update']
export type Enums<EnumName extends keyof DefaultSchema['Enums']> = DefaultSchema['Enums'][EnumName]
