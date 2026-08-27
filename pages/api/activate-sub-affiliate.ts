import { NextApiRequest, NextApiResponse } from 'next'
import { createAdminClient } from '@/lib/supabase-admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { newAffiliateId, parentReferralCode } = req.body ?? {}
  if (!newAffiliateId || !parentReferralCode) {
    return res.status(400).json({ error: 'Données manquantes' })
  }

  try {
    const supabase = createAdminClient()

    const { data: parent } = await supabase
      .from('affiliates')
      .select('id')
      .eq('referral_code', parentReferralCode)
      .single()

    if (parent) {
      await supabase.from('sub_affiliates').insert({
        parent_affiliate_id: parent.id,
        sub_affiliate_id: newAffiliateId,
      })
    }

    return res.status(200).json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erreur serveur' })
  }
}
