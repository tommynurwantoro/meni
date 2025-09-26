import { DataTypes, Model } from 'sequelize';
import sequelize from '../utils/database';

interface ReviewAttributes {
  id: string;
  guild_id: string;
  reporter: string;
  title: string;
  url: string;
  reviewer: string[];
  total_pending: number;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

class Review extends Model<ReviewAttributes> implements ReviewAttributes {
  public id!: string;
  public guild_id!: string;
  public reporter!: string;
  public title!: string;
  public url!: string;
  public reviewer!: string[];
  public total_pending!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at?: Date;
}

Review.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    guild_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    reporter: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    reviewer: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
    },
    total_pending: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Review',
    tableName: 'reviews',
    timestamps: true,
    paranoid: true, // Enables soft deletes
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  }
);

export default Review;