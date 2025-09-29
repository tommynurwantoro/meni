import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

export interface PointsTransactionAttributes {
  id: number;
  from_user_id: string | null;
  to_user_id: string;
  guild_id: string;
  points: number;
  transaction_type: string;
  category: string | null;
  reason: string | null;
  metadata: any;
  created_at: Date;
}

export interface PointsTransactionCreationAttributes extends Optional<PointsTransactionAttributes, 'id' | 'from_user_id' | 'category' | 'reason' | 'metadata' | 'created_at'> {}

export class PointsTransaction extends Model<PointsTransactionAttributes, PointsTransactionCreationAttributes> implements PointsTransactionAttributes {
  public id!: number;
  public from_user_id!: string | null;
  public to_user_id!: string;
  public guild_id!: string;
  public points!: number;
  public transaction_type!: string;
  public category!: string | null;
  public reason!: string | null;
  public metadata!: any;
  public readonly created_at!: Date;
}

PointsTransaction.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    from_user_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    to_user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    guild_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    transaction_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['thanks', 'reward', 'penalty', 'admin_give', 'admin_take', 'system']],
      },
    },
    category: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'points_transactions',
    timestamps: false,
    indexes: [
      {
        fields: ['guild_id'],
      },
      {
        fields: ['to_user_id'],
      },
      {
        fields: ['from_user_id'],
      },
      {
        fields: ['transaction_type'],
      },
      {
        fields: ['created_at'],
      },
    ],
  }
);
