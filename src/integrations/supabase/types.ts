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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          parts: Json | null
          role: Database["public"]["Enums"]["ai_role"]
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          parts?: Json | null
          role: Database["public"]["Enums"]["ai_role"]
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          parts?: Json | null
          role?: Database["public"]["Enums"]["ai_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string
          description: string | null
          entity: string | null
          entity_id: string | null
          id: string
          kind: string
          read_at: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          kind: string
          read_at?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_balances: {
        Row: {
          created_at: string
          id: string
          low_stock_threshold: number
          product_id: string
          quantity: number
          reserved: number
          updated_at: string
          user_id: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          low_stock_threshold?: number
          product_id: string
          quantity?: number
          reserved?: number
          updated_at?: string
          user_id: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          low_stock_threshold?: number
          product_id?: string
          quantity?: number
          reserved?: number
          updated_at?: string
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          balance_after: number | null
          created_at: string
          id: string
          marketplace: Database["public"]["Enums"]["marketplace_channel"] | null
          order_id: string | null
          product_id: string
          quantity: number
          reason: string | null
          type: Database["public"]["Enums"]["movement_type"]
          user_id: string
          variant_id: string | null
        }
        Insert: {
          balance_after?: number | null
          created_at?: string
          id?: string
          marketplace?:
            | Database["public"]["Enums"]["marketplace_channel"]
            | null
          order_id?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          type: Database["public"]["Enums"]["movement_type"]
          user_id: string
          variant_id?: string | null
        }
        Update: {
          balance_after?: number | null
          created_at?: string
          id?: string
          marketplace?:
            | Database["public"]["Enums"]["marketplace_channel"]
            | null
          order_id?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_connections: {
        Row: {
          account_email: string | null
          account_id: string | null
          account_name: string | null
          connected_at: string | null
          created_at: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          marketplace: Database["public"]["Enums"]["marketplace_channel"]
          scopes: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["connection_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          account_id?: string | null
          account_name?: string | null
          connected_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          marketplace: Database["public"]["Enums"]["marketplace_channel"]
          scopes?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          account_id?: string | null
          account_name?: string | null
          connected_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          marketplace?: Database["public"]["Enums"]["marketplace_channel"]
          scopes?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_credentials: {
        Row: {
          access_token: string | null
          connection_id: string
          created_at: string
          expires_at: string | null
          refresh_token: string | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connection_id: string
          created_at?: string
          expires_at?: string | null
          refresh_token?: string | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          connection_id?: string
          created_at?: string
          expires_at?: string | null
          refresh_token?: string | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_credentials_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "marketplace_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          category_path: string | null
          created_at: string
          description: string | null
          external_category_id: string | null
          external_id: string | null
          external_url: string | null
          id: string
          last_error: string | null
          last_sync_at: string | null
          marketplace: Database["public"]["Enums"]["marketplace_channel"]
          price: number | null
          product_id: string
          published_at: string | null
          status: Database["public"]["Enums"]["listing_status"]
          stock: number | null
          title: string | null
          updated_at: string
          user_id: string
          validation_errors: Json
          variant_id: string | null
        }
        Insert: {
          category_path?: string | null
          created_at?: string
          description?: string | null
          external_category_id?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          marketplace: Database["public"]["Enums"]["marketplace_channel"]
          price?: number | null
          product_id: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          stock?: number | null
          title?: string | null
          updated_at?: string
          user_id: string
          validation_errors?: Json
          variant_id?: string | null
        }
        Update: {
          category_path?: string | null
          created_at?: string
          description?: string | null
          external_category_id?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          marketplace?: Database["public"]["Enums"]["marketplace_channel"]
          price?: number | null
          product_id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          stock?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string
          validation_errors?: Json
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          listing_id: string | null
          order_id: string
          product_id: string | null
          quantity: number
          sku: string | null
          title: string
          total_price: number
          unit_price: number
          user_id: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id?: string | null
          order_id: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          title: string
          total_price?: number
          unit_price?: number
          user_id: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          title?: string
          total_price?: number
          unit_price?: number
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_document: string | null
          buyer_email: string | null
          buyer_name: string | null
          created_at: string
          currency: string
          external_order_id: string
          fees_amount: number
          history: Json
          id: string
          marketplace: Database["public"]["Enums"]["marketplace_channel"]
          placed_at: string | null
          raw_payload: Json | null
          shipping_address: Json | null
          shipping_amount: number
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer_document?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          currency?: string
          external_order_id: string
          fees_amount?: number
          history?: Json
          id?: string
          marketplace: Database["public"]["Enums"]["marketplace_channel"]
          placed_at?: string | null
          raw_payload?: Json | null
          shipping_address?: Json | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          buyer_document?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          currency?: string
          external_order_id?: string
          fees_amount?: number
          history?: Json
          id?: string
          marketplace?: Database["public"]["Enums"]["marketplace_channel"]
          placed_at?: string | null
          raw_payload?: Json | null
          shipping_address?: Json | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          position: number
          product_id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          position?: number
          product_id: string
          storage_path: string
          user_id: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json
          barcode: string | null
          created_at: string
          id: string
          name: string
          price: number | null
          product_id: string
          sku: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attributes?: Json
          barcode?: string | null
          created_at?: string
          id?: string
          name: string
          price?: number | null
          product_id: string
          sku?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attributes?: Json
          barcode?: string | null
          created_at?: string
          id?: string
          name?: string
          price?: number | null
          product_id?: string
          sku?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          category: string | null
          cost: number | null
          created_at: string
          description: string | null
          height_cm: number | null
          id: string
          length_cm: number | null
          low_stock_threshold: number
          name: string
          price: number | null
          sku: string | null
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
          user_id: string
          weight_grams: number | null
          width_cm: number | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          low_stock_threshold?: number
          name: string
          price?: number | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
          user_id: string
          weight_grams?: number | null
          width_cm?: number | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          low_stock_threshold?: number
          name?: string
          price?: number | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
          user_id?: string
          weight_grams?: number | null
          width_cm?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_document: string | null
          company_name: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_document?: string | null
          company_name?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_document?: string | null
          company_name?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          buyer_name: string | null
          created_at: string
          external_order_id: string | null
          fees_amount: number
          gross_amount: number
          id: string
          marketplace: Database["public"]["Enums"]["marketplace_channel"]
          net_amount: number | null
          order_id: string | null
          product_title: string | null
          quantity: number
          sold_at: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer_name?: string | null
          created_at?: string
          external_order_id?: string | null
          fees_amount?: number
          gross_amount?: number
          id?: string
          marketplace: Database["public"]["Enums"]["marketplace_channel"]
          net_amount?: number | null
          order_id?: string | null
          product_title?: string | null
          quantity?: number
          sold_at?: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          buyer_name?: string | null
          created_at?: string
          external_order_id?: string | null
          fees_amount?: number
          gross_amount?: number
          id?: string
          marketplace?: Database["public"]["Enums"]["marketplace_channel"]
          net_amount?: number | null
          order_id?: string | null
          product_title?: string | null
          quantity?: number
          sold_at?: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_settings: {
        Row: {
          ai_enabled: boolean
          ai_model: string | null
          ai_provider: string | null
          created_at: string
          currency: string
          default_landing: string
          density: string
          low_stock_threshold: number
          marketplaces: Database["public"]["Enums"]["marketplace_channel"][]
          notifications: Json
          onboarding_completed: boolean
          sells_online: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_enabled?: boolean
          ai_model?: string | null
          ai_provider?: string | null
          created_at?: string
          currency?: string
          default_landing?: string
          density?: string
          low_stock_threshold?: number
          marketplaces?: Database["public"]["Enums"]["marketplace_channel"][]
          notifications?: Json
          onboarding_completed?: boolean
          sells_online?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_enabled?: boolean
          ai_model?: string | null
          ai_provider?: string | null
          created_at?: string
          currency?: string
          default_landing?: string
          density?: string
          low_stock_threshold?: number
          marketplaces?: Database["public"]["Enums"]["marketplace_channel"][]
          notifications?: Json
          onboarding_completed?: boolean
          sells_online?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          created_at: string
          direction: string
          entity: string
          entity_id: string | null
          finished_at: string | null
          id: string
          marketplace: Database["public"]["Enums"]["marketplace_channel"] | null
          message: string | null
          payload: Json | null
          status: Database["public"]["Enums"]["sync_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          direction?: string
          entity: string
          entity_id?: string | null
          finished_at?: string | null
          id?: string
          marketplace?:
            | Database["public"]["Enums"]["marketplace_channel"]
            | null
          message?: string | null
          payload?: Json | null
          status?: Database["public"]["Enums"]["sync_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          entity?: string
          entity_id?: string | null
          finished_at?: string | null
          id?: string
          marketplace?:
            | Database["public"]["Enums"]["marketplace_channel"]
            | null
          message?: string | null
          payload?: Json | null
          status?: Database["public"]["Enums"]["sync_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_inventory_movement: {
        Args: {
          _product_id: string
          _quantity: number
          _reason?: string
          _type: Database["public"]["Enums"]["movement_type"]
          _variant_id: string
        }
        Returns: {
          created_at: string
          id: string
          low_stock_threshold: number
          product_id: string
          quantity: number
          reserved: number
          updated_at: string
          user_id: string
          variant_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "inventory_balances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      ai_role: "user" | "assistant" | "system"
      alert_severity: "info" | "warning" | "critical"
      connection_status: "disconnected" | "connecting" | "connected" | "error"
      listing_status:
        | "draft"
        | "ready"
        | "publishing"
        | "active"
        | "paused"
        | "error"
      marketplace_channel: "mercado_livre" | "shopee" | "amazon"
      movement_type:
        | "entry"
        | "sale"
        | "adjustment"
        | "return"
        | "reservation"
        | "release"
      order_status:
        | "pending"
        | "paid"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded"
      product_status: "active" | "inactive" | "archived"
      sync_status: "pending" | "running" | "success" | "error"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_role: ["user", "assistant", "system"],
      alert_severity: ["info", "warning", "critical"],
      connection_status: ["disconnected", "connecting", "connected", "error"],
      listing_status: [
        "draft",
        "ready",
        "publishing",
        "active",
        "paused",
        "error",
      ],
      marketplace_channel: ["mercado_livre", "shopee", "amazon"],
      movement_type: [
        "entry",
        "sale",
        "adjustment",
        "return",
        "reservation",
        "release",
      ],
      order_status: [
        "pending",
        "paid",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      product_status: ["active", "inactive", "archived"],
      sync_status: ["pending", "running", "success", "error"],
    },
  },
} as const
