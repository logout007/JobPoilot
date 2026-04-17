# ── Variables (all sensitive values — no hardcoded credentials)
variable "gemini_api_key" { sensitive = true }
variable "linkedin_email" { sensitive = true }
variable "linkedin_password" { sensitive = true }
variable "naukri_email" { sensitive = true }
variable "naukri_password" { sensitive = true }
variable "notify_email" {}
variable "cv_text" { sensitive = true }
variable "candidate_phone" { sensitive = true }
variable "internshala_email" { sensitive = true }
variable "internshala_password" { sensitive = true }
variable "shine_email" { sensitive = true }
variable "shine_password" { sensitive = true }
variable "wellfound_email" { sensitive = true }
variable "wellfound_password" { sensitive = true }

# ── User Profile Variables (V2)
variable "profile_name" { default = null }
variable "profile_role" { default = null }
variable "profile_experience" { default = null }
variable "profile_skills" { default = null }
variable "profile_location" { default = null }
variable "profile_work_arrangement" { default = null }
variable "profile_min_salary" { default = null }
variable "profile_target_roles" { default = null }
