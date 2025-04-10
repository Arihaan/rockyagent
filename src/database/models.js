const supabase = require('./supabase');

// Founders and Pitches
const createPitch = async (pitchData) => {
  const { data, error } = await supabase
    .from('pitches')
    .insert([pitchData])
    .select();
  
  if (error) throw error;
  return data[0];
};

const getPitchById = async (pitchId) => {
  const { data, error } = await supabase
    .from('pitches')
    .select('*')
    .eq('id', pitchId)
    .single();
  
  if (error) throw error;
  return data;
};

const getAllPitches = async () => {
  const { data, error } = await supabase
    .from('pitches')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

const updatePitchStatus = async (pitchId, status) => {
  const { data, error } = await supabase
    .from('pitches')
    .update({ status })
    .eq('id', pitchId)
    .select();
  
  if (error) throw error;
  return data[0];
};

// Proposals
const createProposal = async (proposalData) => {
  const { data, error } = await supabase
    .from('proposals')
    .insert([proposalData])
    .select();
  
  if (error) throw error;
  return data[0];
};

const getProposalById = async (proposalId) => {
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', proposalId)
    .single();
  
  if (error) throw error;
  return data;
};

const getAllProposals = async (status = null) => {
  let query = supabase.from('proposals').select('*');
  
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

const updateProposalStatus = async (proposalId, status, txHash = null) => {
  const updates = { status };
  if (txHash) updates.tx_hash = txHash;
  
  const { data, error } = await supabase
    .from('proposals')
    .update(updates)
    .eq('id', proposalId)
    .select();
  
  if (error) throw error;
  return data[0];
};

// Feedback
const addFeedback = async (feedbackData) => {
  const { data, error } = await supabase
    .from('feedback')
    .insert([feedbackData])
    .select();
  
  if (error) throw error;
  return data[0];
};

const getFeedbackByPitchId = async (pitchId) => {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('pitch_id', pitchId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

// Member points
const addPoints = async (userId, telegramUsername, points, reason) => {
  // First check if user exists
  const { data: existingUser } = await supabase
    .from('members')
    .select('*')
    .eq('telegram_id', userId)
    .single();
  
  if (!existingUser) {
    // Create new user
    await supabase
      .from('members')
      .insert([{ 
        telegram_id: userId, 
        telegram_username: telegramUsername,
        points: points 
      }]);
  } else {
    // Update existing user
    await supabase
      .from('members')
      .update({ 
        points: existingUser.points + points,
        telegram_username: telegramUsername // Keep username updated
      })
      .eq('telegram_id', userId);
  }
  
  // Log points transaction
  await supabase
    .from('points_transactions')
    .insert([{
      telegram_id: userId,
      points: points,
      reason: reason,
    }]);
  
  return true;
};

const getLeaderboard = async (limit = 10) => {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('points', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data;
};

// Votes on proposals
const addVote = async (voteData) => {
  const { data, error } = await supabase
    .from('votes')
    .insert([voteData])
    .select();
  
  if (error) throw error;
  return data[0];
};

const getVotesByProposalId = async (proposalId) => {
  const { data, error } = await supabase
    .from('votes')
    .select('*')
    .eq('proposal_id', proposalId);
  
  if (error) throw error;
  return data;
};

module.exports = {
  createPitch,
  getPitchById,
  getAllPitches,
  updatePitchStatus,
  createProposal,
  getProposalById,
  getAllProposals,
  updateProposalStatus,
  addFeedback,
  getFeedbackByPitchId,
  addPoints,
  getLeaderboard,
  addVote,
  getVotesByProposalId
}; 