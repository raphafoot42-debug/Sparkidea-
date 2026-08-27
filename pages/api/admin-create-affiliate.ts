import { NextApiRequest, NextApiResponse } from 'next'
import { createAdminClient } from '@/lib/supabase-admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { email, type, parentReferralCode, name } = req.body ?? {}
  if (!email) {
    return res.status(400).json({ error: 'Email requis' })
  }

  try {
    const supabase = createAdminClient()

    // 1. Generate temp password and create user in Supabase Auth
    const tempPassword = `Spark_${Math.random().toString(36).slice(-8)}!`
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name },
    })

    if (authError || !authData.user) {
      return res.status(500).json({ error: authError?.message ?? 'Erreur lors de la création Auth' })
    }

    const userId = authData.user.id
    const prefix = email.slice(0, 2).toUpperCase()
    const suffix = Math.floor(1000 + Math.random() * 9000)
    const referralCode = `${prefix}${suffix}`

    // 2. Insert into affiliates
    const { error: affiliateError } = await supabase.from('affiliates').insert({
      id: userId,
      email,
      referral_code: referralCode,
      cpa_amount_cents: 1500, // Default 15€
    })

    if (affiliateError) {
      return res.status(500).json({ error: affiliateError.message })
    }

    // 3. Handle sub-affiliate link if parent code supplied
    if (type === 'sub' && parentReferralCode) {
      const { data: parent } = await supabase
        .from('affiliates')
        .select('id')
        .eq('referral_code', parentReferralCode)
        .single()

      if (parent) {
        await supabase.from('sub_affiliates').insert({
          parent_affiliate_id: parent.id,
          sub_affiliate_id: userId,
        })
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const inviteLink = `${appUrl}/login`

    return res.status(200).json({
      success: true,
      userId,
      referralCode,
      inviteLink,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erreur serveur' })
  }
}
