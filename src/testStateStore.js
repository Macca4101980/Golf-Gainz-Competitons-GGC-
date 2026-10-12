/**
 * Isolated GGC test project only.
 * Supabase RLS: public.ggc_state owner_id = auth.uid().
 * Saves use a revision-checked RPC so a stale device cannot silently overwrite another save.
 * Not yet a multi-user shared-society data model.
 */
export function createTestStateStore(supabase) {
  if (!supabase) throw new Error('Supabase client required');
  let revision = 0;
  const id = 'main';
  async function load() {
    const {data:authData,error:authError} = await supabase.auth.getUser();
    if (authError) throw authError;
    const user = authData?.user;
    if (!user) throw new Error('Sign in required');
    const {data,error} = await supabase.from('ggc_state')
      .select('payload,revision').eq('owner_id',user.id).eq('id',id).maybeSingle();
    if (error) throw error;
    revision = Number(data?.revision || 0);
    return data?.payload ?? null;
  }
  async function save(payload) {
    const {data,error} = await supabase.rpc('save_test_state',{
      p_id:id,p_payload:payload,p_expected_revision:revision
    });
    if (error) {
      if (error.code === '40001' || /revision conflict/i.test(error.message || '')) {
        throw new Error('CLOUD_CONFLICT: newer cloud data exists; reload and reconcile before retrying');
      }
      throw error;
    }
    revision = Number(data);
    return revision;
  }
  return {load,save,getRevision:()=>revision};
}
