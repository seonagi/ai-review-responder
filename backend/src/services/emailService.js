const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const emailService = {
  async sendPasswordResetEmail(email, resetToken, frontendUrl) {
    try {
      const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
      
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev',
        to: email,
        subject: 'Reset Your Password - AI Review Responder',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p style="color: #666;">You requested to reset your password. Click the button below to set a new password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #999; font-size: 12px;">Or copy and paste this link in your browser:</p>
            <p style="color: #999; font-size: 12px; word-break: break-all;">${resetLink}</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px;">
              This link will expire in 1 hour. If you didn't request this password reset, please ignore this email.
            </p>
            
            <p style="color: #999; font-size: 12px;">
              Questions? Contact our support team.
            </p>
          </div>
        `,
      });

      if (error) {
        console.error('Resend email error:', error);
        throw new Error(`Failed to send email: ${error.message}`);
      }

      console.log(`✅ Password reset email sent to ${email}`);
      return { success: true, data };
    } catch (error) {
      console.error('Email service error:', error);
      throw error;
    }
  },

  async sendVerificationEmail(email, verificationToken, frontendUrl) {
    try {
      const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}`;
      
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev',
        to: email,
        subject: 'Verify Your Email - AI Review Responder',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Verify Your Email</h2>
            <p style="color: #666;">Thank you for signing up! Click the button below to verify your email:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Verify Email
              </a>
            </div>
            
            <p style="color: #999; font-size: 12px;">This link will expire in 24 hours.</p>
          </div>
        `,
      });

      if (error) {
        console.error('Resend email error:', error);
        throw new Error(`Failed to send verification email: ${error.message}`);
      }

      console.log(`✅ Verification email sent to ${email}`);
      return { success: true, data };
    } catch (error) {
      console.error('Email service error:', error);
      throw error;
    }
  },
};

module.exports = emailService;
