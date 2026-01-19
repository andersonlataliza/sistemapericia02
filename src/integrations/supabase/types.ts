export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          is_confidential: boolean | null
          name: string
          process_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_confidential?: boolean | null
          name: string
          process_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_confidential?: boolean | null
          name?: string
          process_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      linked_users: {
        Row: {
          created_at: string | null
          id: string
          linked_user_cpf: string
          linked_user_email: string | null
          linked_user_name: string
          linked_user_phone: string | null
          owner_user_id: string
          permissions: Json
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          linked_user_cpf: string
          linked_user_email?: string | null
          linked_user_name: string
          linked_user_phone?: string | null
          owner_user_id: string
          permissions?: Json
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          linked_user_cpf?: string
          linked_user_email?: string | null
          linked_user_name?: string
          linked_user_phone?: string | null
          owner_user_id?: string
          permissions?: Json
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          message: string | null
          metadata: Json
          process_id: string | null
          read: boolean
          read_at: string | null
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          process_id?: string | null
          read?: boolean
          read_at?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          process_id?: string | null
          read?: boolean
          read_at?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_access: {
        Row: {
          granted_at: string | null
          granted_by: string
          id: string
          linked_user_id: string
          process_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by: string
          id?: string
          linked_user_id: string
          process_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string
          id?: string
          linked_user_id?: string
          process_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_access_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "linked_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_access_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          epi_intro: string | null
          activities_description: string | null
          discordances_presented: string | null
          attendees: Json | null
          claimant_data: Json | null
          claimant_email: string | null
          claimant_name: string
          collective_protection: string | null
          conclusion: string | null
          court: string | null
          cover_data: Json | null
          created_at: string
          defendant_data: Json | null
          defendant_email: string | null
          defendant_name: string
          defense_data: string | null
          determined_value: number | null
          diligence_data: Json | null
          documents_presented: Json | null
          distribution_date: string | null
          epcs: string | null
          epis: Json | null
          expert_fee: number | null
          flammable_definition: string | null
          id: string
          identifications: Json | null
          initial_data: string | null
          insalubrity_analysis: string | null
          insalubrity_results: string | null
          inspection_address: string | null
          inspection_city: string | null
          inspection_date: string | null
          inspection_duration_minutes: number | null
          inspection_notes: string | null
          inspection_reminder_minutes: number | null
          inspection_status: string | null
          inspection_time: string | null
          methodology: string | null
          objective: string | null
          payment_amount: number | null
          payment_date: string | null
          payment_due_date: string | null
          payment_notes: string | null
          payment_status: string | null
          periculosity_analysis: string | null
          periculosity_concept: string | null
          periculosity_results: string | null
          photos: Json | null
          process_number: string
          report_config: Json | null
          status: string | null
          updated_at: string
          user_id: string
          workplace_characteristics: Json | null
        }
        Insert: {
          epi_intro?: string | null
          activities_description?: string | null
          discordances_presented?: string | null
          attendees?: Json | null
          claimant_data?: Json | null
          claimant_email?: string | null
          claimant_name: string
          collective_protection?: string | null
          conclusion?: string | null
          court?: string | null
          cover_data?: Json | null
          created_at?: string
          defendant_data?: Json | null
          defendant_email?: string | null
          defendant_name: string
          defense_data?: string | null
          determined_value?: number | null
          diligence_data?: Json | null
          documents_presented?: Json | null
          distribution_date?: string | null
          epcs?: string | null
          epis?: Json | null
          expert_fee?: number | null
          flammable_definition?: string | null
          id?: string
          identifications?: Json | null
          initial_data?: string | null
          insalubrity_analysis?: string | null
          insalubrity_results?: string | null
          inspection_address?: string | null
          inspection_city?: string | null
          inspection_date?: string | null
          inspection_duration_minutes?: number | null
          inspection_notes?: string | null
          inspection_reminder_minutes?: number | null
          inspection_status?: string | null
          inspection_time?: string | null
          methodology?: string | null
          objective?: string | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_due_date?: string | null
          payment_notes?: string | null
          payment_status?: string | null
          periculosity_analysis?: string | null
          periculosity_concept?: string | null
          periculosity_results?: string | null
          photos?: Json | null
          process_number: string
          report_config?: Json | null
          status?: string | null
          updated_at?: string
          user_id: string
          workplace_characteristics?: Json | null
        }
        Update: {
          epi_intro?: string | null
          activities_description?: string | null
          discordances_presented?: string | null
          attendees?: Json | null
          claimant_data?: Json | null
          claimant_email?: string | null
          claimant_name?: string
          collective_protection?: string | null
          conclusion?: string | null
          court?: string | null
          cover_data?: Json | null
          created_at?: string
          defendant_data?: Json | null
          defendant_email?: string | null
          defendant_name?: string
          defense_data?: string | null
          determined_value?: number | null
          diligence_data?: Json | null
          documents_presented?: Json | null
          distribution_date?: string | null
          epcs?: string | null
          epis?: Json | null
          expert_fee?: number | null
          flammable_definition?: string | null
          id?: string
          identifications?: Json | null
          initial_data?: string | null
          insalubrity_analysis?: string | null
          insalubrity_results?: string | null
          inspection_address?: string | null
          inspection_city?: string | null
          inspection_date?: string | null
          inspection_duration_minutes?: number | null
          inspection_notes?: string | null
          inspection_reminder_minutes?: number | null
          inspection_status?: string | null
          inspection_time?: string | null
          methodology?: string | null
          objective?: string | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_due_date?: string | null
          payment_notes?: string | null
          payment_status?: string | null
          periculosity_analysis?: string | null
          periculosity_concept?: string | null
          periculosity_results?: string | null
          photos?: Json | null
          process_number?: string
          report_config?: Json | null
          status?: string | null
          updated_at?: string
          user_id?: string
          workplace_characteristics?: Json | null
        }
        Relationships: []
      }
      schedule_email_receipts: {
        Row: {
          body: string
          confirmed_at: string | null
          created_at: string
          error: string | null
          id: string
          opened_at: string | null
          process_id: string
          provider: string | null
          provider_message_id: string | null
          recipient_email: string
          recipient_role: string
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          confirmed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          opened_at?: string | null
          process_id: string
          provider?: string | null
          provider_message_id?: string | null
          recipient_email: string
          recipient_role: string
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          confirmed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          opened_at?: string | null
          process_id?: string
          provider?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          recipient_role?: string
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_email_receipts_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string | null
          created_at: string
          full_name: string | null
          id: string
          is_blocked: boolean
          email: string | null
          professional_title: string | null
          registration_number: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_blocked?: boolean
          email?: string | null
          professional_title?: string | null
          registration_number?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          email?: string | null
          professional_title?: string | null
          registration_number?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      questionnaires: {
        Row: {
          answer: string | null
          attachments: Json | null
          created_at: string
          id: string
          notes: string | null
          party: string
          process_id: string
          question: string
          question_number: number
          updated_at: string
        }
        Insert: {
          answer?: string | null
          attachments?: Json | null
          created_at?: string
          id?: string
          notes?: string | null
          party: string
          process_id: string
          question: string
          question_number: number
          updated_at?: string
        }
        Update: {
          answer?: string | null
          attachments?: Json | null
          created_at?: string
          id?: string
          notes?: string | null
          party?: string
          process_id?: string
          question?: string
          question_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaires_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          content: string | null
          created_at: string
          delivered_at: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          generated_at: string | null
          id: string
          process_id: string
          report_type: string
          status: string | null
          title: string
          updated_at: string
          version: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          generated_at?: string | null
          id?: string
          process_id: string
          report_type: string
          status?: string | null
          title: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          generated_at?: string | null
          id?: string
          process_id?: string
          report_type?: string
          status?: string | null
          title?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_agents: {
        Row: {
          agent_name: string
          agent_type: string
          created_at: string
          description: string | null
          evidence_photos: Json | null
          exposure_level: string | null
          id: string
          insalubrity_degree: string | null
          measurement_method: string | null
          measurement_unit: string | null
          measurement_value: number | null
          notes: string | null
          periculosity_applicable: boolean | null
          process_id: string
          risk_level: string | null
          tolerance_limit: number | null
          tolerance_unit: string | null
          updated_at: string
        }
        Insert: {
          agent_name: string
          agent_type: string
          created_at?: string
          description?: string | null
          evidence_photos?: Json | null
          exposure_level?: string | null
          id?: string
          insalubrity_degree?: string | null
          measurement_method?: string | null
          measurement_unit?: string | null
          measurement_value?: number | null
          notes?: string | null
          periculosity_applicable?: boolean | null
          process_id: string
          risk_level?: string | null
          tolerance_limit?: number | null
          tolerance_unit?: string | null
          updated_at?: string
        }
        Update: {
          agent_name?: string
          agent_type?: string
          created_at?: string
          description?: string | null
          evidence_photos?: Json | null
          exposure_level?: string | null
          id?: string
          insalubrity_degree?: string | null
          measurement_method?: string | null
          measurement_unit?: string | null
          measurement_value?: number | null
          notes?: string | null
          periculosity_applicable?: boolean | null
          process_id?: string
          risk_level?: string | null
          tolerance_limit?: number | null
          tolerance_unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_agents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          id: string
          user_id: string
          external_id: string
          name: string
          text: string | null
          nr15_annexes: Json | null
          nr16_annexes: Json | null
          nr15_enquadramento: boolean | null
          nr16_enquadramento: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          external_id: string
          name: string
          text?: string | null
          nr15_annexes?: Json | null
          nr16_annexes?: Json | null
          nr15_enquadramento?: boolean | null
          nr16_enquadramento?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          external_id?: string
          name?: string
          text?: string | null
          nr15_annexes?: Json | null
          nr16_annexes?: Json | null
          nr15_enquadramento?: boolean | null
          nr16_enquadramento?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      manufacturer_technical_bulletins: {
        Row: {
          id: string
          user_id: string
          epi: string
          ca: string
          protection_type: string
          estimated_lifetime: string | null
          attachment_path: string
          attachment_name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          epi: string
          ca: string
          protection_type: string
          estimated_lifetime?: string | null
          attachment_path: string
          attachment_name: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          epi?: string
          ca?: string
          protection_type?: string
          estimated_lifetime?: string | null
          attachment_path?: string
          attachment_name?: string
          created_at?: string
        }
        Relationships: []
      }
      fispq_records: {
        Row: {
          id: string
          user_id: string
          product_identification: string | null
          hazard_identification: string | null
          composition: string | null
          nr15_annex: string | null
          tolerance_limit: string | null
          skin_absorption_risk: string | null
          flash_point: string | null
          attachment_path: string
          attachment_name: string
          extracted_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_identification?: string | null
          hazard_identification?: string | null
          composition?: string | null
          nr15_annex?: string | null
          tolerance_limit?: string | null
          skin_absorption_risk?: string | null
          flash_point?: string | null
          attachment_path: string
          attachment_name: string
          extracted_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_identification?: string | null
          hazard_identification?: string | null
          composition?: string | null
          nr15_annex?: string | null
          tolerance_limit?: string | null
          skin_absorption_risk?: string | null
          flash_point?: string | null
          attachment_path?: string
          attachment_name?: string
          extracted_text?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_database_usage: {
        Args: Record<PropertyKey, never>
        Returns: {
          db_size_bytes: number
          processes_table_bytes: number
        }[]
      }
      admin_users_usage: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          processes_count: number
          processes_bytes: number
        }[]
      }
      get_processes_by_cpf: {
        Args: { user_cpf: string }
        Returns: {
          claimant_name: string
          court: string
          created_at: string
          defendant_name: string
          process_id: string
          process_number: string
          status: string
        }[]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      validate_cpf: { Args: { cpf_input: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

export type PublicSchema = DatabaseWithoutInternals["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Row: infer R } ? R : never;

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Insert: infer I } ? I : never;

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Update: infer U } ? U : never;

export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

export type CompositeTypes<T extends keyof PublicSchema["CompositeTypes"]> =
  PublicSchema["CompositeTypes"][T];
