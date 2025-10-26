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
      documents: {
        Row: {
          document_type: string
          extracted_data: Json | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          process_id: string
          uploaded_at: string
        }
        Insert: {
          document_type: string
          extracted_data?: Json | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          process_id: string
          uploaded_at?: string
        }
        Update: {
          document_type?: string
          extracted_data?: Json | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          process_id?: string
          uploaded_at?: string
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
      processes: {
        Row: {
          activities_description: string | null
          attendees: Json | null
          claimant_data: Json | null
          claimant_name: string
          collective_protection: string | null
          conclusion: string | null
          court: string | null
          cover_data: Json | null
          created_at: string
          defendant_data: Json | null
          defendant_name: string
          defense_data: string | null
          diligence_data: Json | null
          documents_presented: Json | null
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
          inspection_date: string | null
          methodology: string | null
          objective: string | null
          periculosity_analysis: string | null
          periculosity_concept: string | null
          periculosity_results: string | null
          photos: Json | null
          process_number: string
          status: string
          updated_at: string
          user_id: string
          workplace_characteristics: Json | null
        }
        Insert: {
          activities_description?: string | null
          attendees?: Json | null
          claimant_data?: Json | null
          claimant_name: string
          collective_protection?: string | null
          conclusion?: string | null
          court?: string | null
          cover_data?: Json | null
          created_at?: string
          defendant_data?: Json | null
          defendant_name: string
          defense_data?: string | null
          diligence_data?: Json | null
          documents_presented?: Json | null
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
          inspection_date?: string | null
          methodology?: string | null
          objective?: string | null
          periculosity_analysis?: string | null
          periculosity_concept?: string | null
          periculosity_results?: string | null
          photos?: Json | null
          process_number: string
          status?: string
          updated_at?: string
          user_id: string
          workplace_characteristics?: Json | null
        }
        Update: {
          activities_description?: string | null
          attendees?: Json | null
          claimant_data?: Json | null
          claimant_name?: string
          collective_protection?: string | null
          conclusion?: string | null
          court?: string | null
          cover_data?: Json | null
          created_at?: string
          defendant_data?: Json | null
          defendant_name?: string
          defense_data?: string | null
          diligence_data?: Json | null
          documents_presented?: Json | null
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
          inspection_date?: string | null
          methodology?: string | null
          objective?: string | null
          periculosity_analysis?: string | null
          periculosity_concept?: string | null
          periculosity_results?: string | null
          photos?: Json | null
          process_number?: string
          status?: string
          updated_at?: string
          user_id?: string
          workplace_characteristics?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          professional_title: string | null
          registration_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          professional_title?: string | null
          registration_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          professional_title?: string | null
          registration_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      questionnaires: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          party: string
          process_id: string
          question: string
          question_number: number
          updated_at: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          party: string
          process_id: string
          question: string
          question_number: number
          updated_at?: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
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
          conclusion: string | null
          generated_at: string
          id: string
          insalubrity_grade: string | null
          periculosity_identified: boolean | null
          process_id: string
          report_content: string | null
          report_docx_url: string | null
          report_pdf_url: string | null
        }
        Insert: {
          conclusion?: string | null
          generated_at?: string
          id?: string
          insalubrity_grade?: string | null
          periculosity_identified?: boolean | null
          process_id: string
          report_content?: string | null
          report_docx_url?: string | null
          report_pdf_url?: string | null
        }
        Update: {
          conclusion?: string | null
          generated_at?: string
          id?: string
          insalubrity_grade?: string | null
          periculosity_identified?: boolean | null
          process_id?: string
          report_content?: string | null
          report_docx_url?: string | null
          report_pdf_url?: string | null
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
          agent_type: string
          created_at: string
          epi_ca: string | null
          epi_effective: boolean | null
          epi_type: string | null
          exposure_days_per_week: number | null
          exposure_hours_per_day: number | null
          frequency: string | null
          id: string
          intensity_value: number | null
          period_end: string | null
          period_start: string | null
          process_id: string
          unit: string | null
        }
        Insert: {
          agent_type: string
          created_at?: string
          epi_ca?: string | null
          epi_effective?: boolean | null
          epi_type?: string | null
          exposure_days_per_week?: number | null
          exposure_hours_per_day?: number | null
          frequency?: string | null
          id?: string
          intensity_value?: number | null
          period_end?: string | null
          period_start?: string | null
          process_id: string
          unit?: string | null
        }
        Update: {
          agent_type?: string
          created_at?: string
          epi_ca?: string | null
          epi_effective?: boolean | null
          epi_type?: string | null
          exposure_days_per_week?: number | null
          exposure_hours_per_day?: number | null
          frequency?: string | null
          id?: string
          intensity_value?: number | null
          period_end?: string | null
          period_start?: string | null
          process_id?: string
          unit?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
