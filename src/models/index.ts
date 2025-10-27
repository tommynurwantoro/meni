import { Review } from './Review';
import { PointsUser } from './PointsUser';
import { PointsTransaction } from './PointsTransaction';
import { GitLabToken } from './GitLabToken';
import sequelize from '../utils/database';

// Initialize all models
const models = {
  Review,
  PointsUser,
  PointsTransaction,
  GitLabToken,
};

// Export individual models
export { Review, PointsUser, PointsTransaction, GitLabToken };

// Define associations - without foreign key constraints to avoid type conflicts
PointsUser.hasMany(PointsTransaction, {
  foreignKey: 'to_user_id',
  sourceKey: 'discord_id',
  as: 'receivedTransactions',
  constraints: false, // Disable foreign key constraints
});

PointsUser.hasMany(PointsTransaction, {
  foreignKey: 'from_user_id',
  sourceKey: 'discord_id',
  as: 'sentTransactions',
  constraints: false, // Disable foreign key constraints
});

PointsTransaction.belongsTo(PointsUser, {
  foreignKey: 'to_user_id',
  targetKey: 'discord_id',
  as: 'recipient',
  constraints: false, // Disable foreign key constraints
});

PointsTransaction.belongsTo(PointsUser, {
  foreignKey: 'from_user_id',
  targetKey: 'discord_id',
  as: 'sender',
  constraints: false, // Disable foreign key constraints
});

// Sync database
export async function syncDatabase() {
  try {
    // Alter existing tables instead of recreating them
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synchronized successfully');
  } catch (error) {
    console.error('❌ Error synchronizing database models:', error);
    throw error;
  }
}

export { models };
