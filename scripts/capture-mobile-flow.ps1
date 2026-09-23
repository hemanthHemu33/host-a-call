$ErrorActionPreference = 'Continue'

$desktop = [Environment]::GetFolderPath('Desktop')
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$root = Join-Path $desktop "connecto-backend-flow-screenshots-$stamp"
New-Item -ItemType Directory -Path $root -Force | Out-Null

$manifest = New-Object System.Collections.Generic.List[object]
$script:startTime = Get-Date
$script:captureIndex = 0

function Safe-Name([string]$value) {
  return (($value -replace '[^a-zA-Z0-9._-]+', '_').Trim('_')).ToLowerInvariant()
}

function Invoke-AdbRoute([string]$uri) {
  adb shell input keyevent 111 2>$null | Out-Null
  $quoted = "'$uri'"
  adb shell am start -W -a android.intent.action.VIEW -d $quoted com.connecto.mobile 2>$null | Out-Null
}

function Read-UiDoc([string]$xmlPath) {
  adb shell uiautomator dump /sdcard/window.xml 2>$null | Out-Null
  adb pull /sdcard/window.xml $xmlPath 2>$null | Out-Null
  try {
    return [xml](Get-Content $xmlPath -Raw)
  } catch {
    return $null
  }
}

function Get-Attr($node, [string]$name) {
  try {
    return $node.GetAttribute($name)
  } catch {
    return ''
  }
}

function Normalize-Text([string]$value) {
  return (($value -replace '\s+', ' ').Trim())
}

function Capture-Current(
  [string]$section,
  [string]$name,
  [string]$route,
  [string]$state
) {
  $script:captureIndex++
  $prefix = ('{0:d3}-{1}-{2}-{3}' -f $script:captureIndex, (Safe-Name $section), (Safe-Name $name), (Safe-Name $state))
  $png = Join-Path $root "$prefix.png"
  $xml = Join-Path $root "$prefix.xml"

  $remotePng = '/sdcard/connecto-capture.png'
  adb shell screencap -p $remotePng 2>$null | Out-Null
  adb pull $remotePng $png 2>$null | Out-Null
  $doc = Read-UiDoc $xml

  $texts = @()
  $descs = @()
  $scrollable = $false

  if ($doc -ne $null) {
    $texts = @(
      $doc.SelectNodes('//*[@text]') |
        ForEach-Object { Normalize-Text (Get-Attr $_ 'text') } |
        Where-Object { $_.Length -gt 0 } |
        Select-Object -Unique -First 32
    )
    $descs = @(
      $doc.SelectNodes('//*[@content-desc]') |
        ForEach-Object { Normalize-Text (Get-Attr $_ 'content-desc') } |
        Where-Object { $_.Length -gt 0 } |
        Select-Object -Unique -First 16
    )
    $scrollable = @($doc.SelectNodes("//*[@scrollable='true']")).Count -gt 0
  }

  $item = Get-Item $png -ErrorAction SilentlyContinue
  $manifest.Add([pscustomobject]@{
    index = $script:captureIndex
    section = $section
    screen = $name
    route = $route
    state = $state
    png = Split-Path $png -Leaf
    xml = Split-Path $xml -Leaf
    bytes = if ($item) { $item.Length } else { 0 }
    scrollable = $scrollable
    visibleText = ($texts -join ' | ')
    contentDescriptions = ($descs -join ' | ')
  }) | Out-Null

  Write-Output ("CAPTURED {0:d3} {1}/{2} [{3}]" -f $script:captureIndex, $section, $name, $state)
}

function Capture-Route(
  [string]$section,
  [string]$name,
  [string]$uri,
  [int]$waitSeconds = 6,
  [int]$scrolls = 0
) {
  Invoke-AdbRoute $uri
  Start-Sleep -Seconds $waitSeconds
  Capture-Current $section $name $uri 'top'

  for ($i = 1; $i -le $scrolls; $i++) {
    adb shell input swipe 540 2030 540 620 420 2>$null | Out-Null
    Start-Sleep -Milliseconds 900
    Capture-Current $section $name $uri "scroll$i"
  }
}

function Find-Node($doc, [string]$resourceId, [string]$text, [string]$desc) {
  if ($doc -eq $null) {
    return $null
  }

  $nodes = @($doc.SelectNodes('//*[@bounds]'))
  foreach ($node in $nodes) {
    if ($resourceId -and (Get-Attr $node 'resource-id') -eq $resourceId) {
      return $node
    }
    if ($text -and (Get-Attr $node 'text') -eq $text) {
      return $node
    }
    if ($desc -and (Get-Attr $node 'content-desc') -eq $desc) {
      return $node
    }
  }

  return $null
}

function Tap-Node($node) {
  $bounds = Get-Attr $node 'bounds'
  if ($bounds -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
    $x = [int](([int]$Matches[1] + [int]$Matches[3]) / 2)
    $y = [int](([int]$Matches[2] + [int]$Matches[4]) / 2)
    adb shell input tap $x $y 2>$null | Out-Null
    Start-Sleep -Milliseconds 650
    return $true
  }

  return $false
}

function Scroll-ToTop([int]$swipes = 4) {
  for ($i = 0; $i -lt $swipes; $i++) {
    adb shell input swipe 540 660 540 2030 360 2>$null | Out-Null
    Start-Sleep -Milliseconds 450
  }
}

function Tap-Target(
  [string]$resourceId = '',
  [string]$text = '',
  [string]$desc = '',
  [int]$tries = 5
) {
  for ($i = 0; $i -lt $tries; $i++) {
    $tmpXml = Join-Path $root '_tap-window.xml'
    $doc = Read-UiDoc $tmpXml
    $node = Find-Node $doc $resourceId $text $desc

    if ($node -ne $null) {
      return (Tap-Node $node)
    }

    adb shell input swipe 540 2020 540 660 380 2>$null | Out-Null
    Start-Sleep -Milliseconds 700
  }

  Write-Output "WARN tap target not found resource=$resourceId text=$text desc=$desc"
  return $false
}

function Input-AdbText([string]$text) {
  $escaped = $text -replace ' ', '%s'
  adb shell input text $escaped 2>$null | Out-Null
  Start-Sleep -Milliseconds 600
}

function Relaunch-LoggedOut() {
  adb reverse tcp:8081 tcp:8081 | Out-Null
  adb shell pm clear com.connecto.mobile | Out-Null
  Start-Sleep -Seconds 2

  foreach ($perm in @(
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.RECORD_AUDIO',
    'android.permission.CAMERA',
    'android.permission.POST_NOTIFICATIONS'
  )) {
    adb shell pm grant com.connecto.mobile $perm 2>$null | Out-Null
  }

  adb shell input keyevent 82 2>$null | Out-Null
  adb shell wm dismiss-keyguard 2>$null | Out-Null
  adb shell input swipe 540 2000 540 600 350 2>$null | Out-Null
  Invoke-AdbRoute 'connecto://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081'
  Start-Sleep -Seconds 38
}

function Seed-Role([string]$targetRole) {
  Capture-Route 'internal' 'developer_scenarios_before_seed' 'connecto://developer-scenarios' 4 0
  Tap-Target -resourceId 'scenario-reset' -tries 8 | Out-Null
  Start-Sleep -Seconds 2

  if ($targetRole -eq 'host') {
    Capture-Route 'internal' 'developer_scenarios_before_host_toggle' 'connecto://developer-scenarios' 2 0
    Scroll-ToTop 5
    Tap-Target -resourceId 'scenario-role' -tries 4 | Out-Null
    Start-Sleep -Seconds 2
  }
}

Write-Output "OUTPUT_DIR=$root"

Relaunch-LoggedOut
Capture-Current 'public' 'login_initial_after_clean_launch' 'connecto://expo-development-client/?url=http://127.0.0.1:8081' 'top'

$publicRoutes = @(
  @{s='public'; n='age_confirmation'; u='connecto:///(auth)/age-confirmation'; w=5; sc=0},
  @{s='public'; n='referral_code_entry'; u='connecto:///(auth)/referral-code'; w=5; sc=0},
  @{s='public'; n='blocked_account'; u='connecto:///(auth)/blocked-account'; w=5; sc=0},
  @{s='public'; n='suspended_account'; u='connecto:///(auth)/suspended-account'; w=5; sc=0},
  @{s='public'; n='underage_block'; u='connecto:///(auth)/underage-block'; w=5; sc=0},
  @{s='public'; n='mandatory_update'; u='connecto://mandatory-update'; w=5; sc=0},
  @{s='public'; n='invalid_link'; u='connecto://invalid-link'; w=5; sc=0},
  @{s='public'; n='legal_terms'; u='connecto://legal/terms'; w=5; sc=1},
  @{s='public'; n='legal_privacy'; u='connecto://legal/privacy'; w=5; sc=1},
  @{s='public'; n='legal_community_guidelines'; u='connecto://legal/community-guidelines'; w=5; sc=1},
  @{s='public_links'; n='referral_link'; u='connecto://referral/CONNECTO100'; w=6; sc=0},
  @{s='public_links'; n='support_ticket_link'; u='connecto://link/support-ticket/ticket_1'; w=6; sc=0},
  @{s='public_links'; n='payment_result_link'; u='connecto://link/payment-result'; w=6; sc=0},
  @{s='public_links'; n='notification_link'; u='connecto://link/notification/calls'; w=6; sc=0},
  @{s='public_links'; n='call_invitation_link'; u='connecto://link/call-invitation/invitation_1'; w=6; sc=0}
)
foreach ($r in $publicRoutes) {
  Capture-Route $r.s $r.n $r.u $r.w $r.sc
}

Capture-Route 'auth_flow' 'login_empty' 'connecto:///(auth)/login' 5 0
Tap-Target -desc 'Your Mobile Number' -tries 3 | Out-Null
Input-AdbText '9000000002'
Capture-Current 'auth_flow' 'login_filled_new_customer' 'connecto:///(auth)/login' 'filled'
Tap-Target -desc 'Get OTP' -tries 3 | Out-Null
Start-Sleep -Seconds 5
Capture-Current 'auth_flow' 'otp_entry' 'connecto:///(auth)/otp' 'top'
Tap-Target -resourceId 'auth-otp' -tries 2 | Out-Null
Input-AdbText '246810'
Capture-Current 'auth_flow' 'otp_filled' 'connecto:///(auth)/otp' 'filled'
Tap-Target -desc 'Verify code' -tries 3 | Out-Null
Start-Sleep -Seconds 7
Capture-Current 'customer_onboarding' 'profile_setup_empty' 'connecto:///(customer-onboarding)/profile-setup' 'top'
Tap-Target -resourceId 'onboarding-display-name' -tries 4 | Out-Null
Input-AdbText 'Asha'
Tap-Target -resourceId 'onboarding-date-of-birth' -tries 4 | Out-Null
Input-AdbText '12081995'
adb shell input keyevent 111 2>$null | Out-Null
Tap-Target -resourceId 'onboarding-gender-woman' -tries 6 | Out-Null
Capture-Current 'customer_onboarding' 'profile_setup_filled_host_applicant' 'connecto:///(customer-onboarding)/profile-setup' 'filled'
Tap-Target -desc 'Continue' -tries 5 | Out-Null
Start-Sleep -Seconds 5
Capture-Current 'customer_onboarding' 'language_selection' 'connecto:///(customer-onboarding)/language' 'top'
Tap-Target -resourceId 'onboarding-primary-language-Telugu' -tries 5 | Out-Null
Capture-Current 'customer_onboarding' 'language_selection_telugu' 'connecto:///(customer-onboarding)/language' 'selected'
Tap-Target -desc 'Continue' -tries 5 | Out-Null
Start-Sleep -Seconds 4
Capture-Current 'customer_onboarding' 'match_tags' 'connecto:///(customer-onboarding)/match-tags' 'top'
foreach ($tag in @('friendship', 'love', 'marriage')) {
  Tap-Target -resourceId "onboarding-match-tag-$tag" -tries 5 | Out-Null
}
Capture-Current 'customer_onboarding' 'match_tags_selected' 'connecto:///(customer-onboarding)/match-tags' 'selected'
Tap-Target -desc 'Continue' -tries 5 | Out-Null
Start-Sleep -Seconds 5
Capture-Current 'customer_onboarding' 'permissions_review' 'connecto:///(customer-onboarding)/permissions' 'top'
Tap-Target -resourceId 'onboarding-finish' -tries 6 | Out-Null
Start-Sleep -Seconds 8
Capture-Current 'customer_onboarding' 'voice_verification_initial' 'connecto:///(customer-onboarding)/voice-verification' 'top'
Tap-Target -resourceId 'onboarding-record-voice' -tries 5 | Out-Null
Start-Sleep -Seconds 3
Capture-Current 'customer_onboarding' 'voice_verification_recording' 'connecto:///(customer-onboarding)/voice-verification' 'recording'
Tap-Target -resourceId 'onboarding-record-voice' -tries 5 | Out-Null
Start-Sleep -Seconds 3
Capture-Current 'customer_onboarding' 'voice_verification_recorded' 'connecto:///(customer-onboarding)/voice-verification' 'recorded'
Tap-Target -resourceId 'onboarding-submit-voice-verification' -tries 5 | Out-Null
Start-Sleep -Milliseconds 700
Capture-Current 'customer_onboarding' 'host_approval_pending' 'connecto:///(customer-onboarding)/host-approval' 'top'
Start-Sleep -Seconds 4
Capture-Current 'customer_onboarding' 'host_agreement' 'connecto:///(customer-onboarding)/host-agreement' 'top'
Tap-Target -resourceId 'onboarding-host-agreement-checkbox' -tries 5 | Out-Null
Capture-Current 'customer_onboarding' 'host_agreement_accepted' 'connecto:///(customer-onboarding)/host-agreement' 'accepted'
Tap-Target -resourceId 'onboarding-submit-host-agreement' -tries 5 | Out-Null
Start-Sleep -Seconds 6
Capture-Current 'host_flow' 'post_application_host_dashboard' 'connecto:///(host)/dashboard' 'top'

Seed-Role 'customer'
$customerRoutes = @(
  @{s='customer'; n='home'; u='connecto:///(customer)/home'; w=6; sc=1},
  @{s='customer'; n='filters'; u='connecto:///(customer)/filters'; w=5; sc=0},
  @{s='customer'; n='calls'; u='connecto:///(customer)/calls'; w=6; sc=1},
  @{s='customer'; n='call_detail'; u='connecto:///(customer)/calls/call_1'; w=6; sc=1},
  @{s='customer'; n='profile'; u='connecto:///(customer)/profile'; w=6; sc=1},
  @{s='customer'; n='profile_edit'; u='connecto:///(customer)/profile-edit'; w=6; sc=2},
  @{s='customer'; n='settings'; u='connecto:///(customer)/settings'; w=5; sc=1},
  @{s='customer'; n='language_settings'; u='connecto:///(customer)/language-settings'; w=5; sc=1},
  @{s='customer'; n='motion_settings'; u='connecto:///(customer)/motion-settings'; w=5; sc=1},
  @{s='customer'; n='notifications'; u='connecto:///(customer)/notifications'; w=5; sc=1},
  @{s='customer'; n='notification_preferences'; u='connecto:///(customer)/notification-preferences'; w=5; sc=1},
  @{s='customer'; n='privacy_safety'; u='connecto:///(customer)/privacy-safety'; w=5; sc=1},
  @{s='customer'; n='blocked_users'; u='connecto:///(customer)/blocked-users'; w=5; sc=0},
  @{s='customer'; n='report_history'; u='connecto:///(customer)/report-history'; w=5; sc=1},
  @{s='customer'; n='delete_account'; u='connecto:///(customer)/delete-account'; w=5; sc=1},
  @{s='customer'; n='add_money'; u='connecto:///(customer)/add-money'; w=5; sc=0},
  @{s='customer'; n='payment_states'; u='connecto:///(customer)/payment-states'; w=5; sc=1},
  @{s='customer'; n='referrals'; u='connecto:///(customer)/referrals'; w=5; sc=1},
  @{s='customer'; n='referral_detail'; u='connecto:///(customer)/referrals/referral_1'; w=5; sc=1},
  @{s='customer'; n='support'; u='connecto:///(customer)/support'; w=5; sc=1},
  @{s='customer'; n='support_ticket'; u='connecto:///(customer)/support-ticket/ticket_1'; w=5; sc=1},
  @{s='customer'; n='transaction_detail'; u='connecto:///(customer)/transaction/transaction_1'; w=5; sc=1}
)
foreach ($r in $customerRoutes) {
  Capture-Route $r.s $r.n $r.u $r.w $r.sc
}

$customerCallRoutes = @(
  @{s='customer_calls'; n='outgoing_call'; u='connecto://call/outgoing'; w=7; sc=0},
  @{s='customer_calls'; n='voice_call'; u='connecto://call/voice'; w=7; sc=0},
  @{s='customer_calls'; n='video_request'; u='connecto://call/video-request'; w=7; sc=0},
  @{s='customer_calls'; n='video_call'; u='connecto://call/video'; w=7; sc=0},
  @{s='customer_calls'; n='reconnecting'; u='connecto://call/reconnecting'; w=7; sc=0},
  @{s='customer_calls'; n='report_call'; u='connecto://call/report'; w=6; sc=1},
  @{s='customer_calls'; n='call_summary'; u='connecto://call/summary'; w=6; sc=1}
)
foreach ($r in $customerCallRoutes) {
  Capture-Route $r.s $r.n $r.u $r.w $r.sc
}

Seed-Role 'host'
$hostRoutes = @(
  @{s='host_onboarding'; n='profile_setup'; u='connecto:///(host-onboarding)/host-profile-setup'; w=6; sc=1},
  @{s='host_onboarding'; n='photo'; u='connecto:///(host-onboarding)/photo'; w=6; sc=1},
  @{s='host_onboarding'; n='rules'; u='connecto:///(host-onboarding)/rules'; w=6; sc=1},
  @{s='host_onboarding'; n='verification'; u='connecto:///(host-onboarding)/verification'; w=6; sc=1},
  @{s='host_onboarding'; n='payout'; u='connecto:///(host-onboarding)/payout'; w=6; sc=1},
  @{s='host_onboarding'; n='agreement'; u='connecto:///(host-onboarding)/agreement'; w=6; sc=1},
  @{s='host_onboarding'; n='application_states'; u='connecto:///(host-onboarding)/application-states'; w=6; sc=1},
  @{s='host'; n='dashboard'; u='connecto:///(host)/dashboard'; w=6; sc=1},
  @{s='host'; n='calls'; u='connecto:///(host)/calls'; w=6; sc=1},
  @{s='host'; n='recent'; u='connecto:///(host)/recent'; w=6; sc=1},
  @{s='host'; n='earnings'; u='connecto:///(host)/earnings'; w=6; sc=1},
  @{s='host'; n='withdrawal'; u='connecto:///(host)/withdrawal'; w=6; sc=1},
  @{s='host'; n='profile'; u='connecto:///(host)/profile'; w=6; sc=1},
  @{s='host'; n='profile_edit'; u='connecto:///(host)/profile-edit'; w=6; sc=2},
  @{s='host'; n='bank_account_add'; u='connecto:///(host)/bank-account-add'; w=6; sc=1},
  @{s='host'; n='referrals'; u='connecto:///(host)/referrals'; w=6; sc=1},
  @{s='host'; n='settings'; u='connecto:///(host)/settings'; w=6; sc=1},
  @{s='host'; n='leaderboard'; u='connecto:///(host)/leaderboard'; w=6; sc=1}
)
foreach ($r in $hostRoutes) {
  Capture-Route $r.s $r.n $r.u $r.w $r.sc
}

$hostCallRoutes = @(
  @{s='host_calls'; n='incoming_call'; u='connecto://call/incoming'; w=7; sc=0},
  @{s='host_calls'; n='voice_call'; u='connecto://call/voice'; w=7; sc=0},
  @{s='host_calls'; n='video_request'; u='connecto://call/video-request'; w=7; sc=0},
  @{s='host_calls'; n='video_call'; u='connecto://call/video'; w=7; sc=0},
  @{s='host_calls'; n='reconnecting'; u='connecto://call/reconnecting'; w=7; sc=0},
  @{s='host_calls'; n='report_call'; u='connecto://call/report'; w=6; sc=1},
  @{s='host_calls'; n='call_summary'; u='connecto://call/summary'; w=6; sc=1}
)
foreach ($r in $hostCallRoutes) {
  Capture-Route $r.s $r.n $r.u $r.w $r.sc
}

$internalRoutes = @(
  @{s='internal'; n='developer_scenarios'; u='connecto://developer-scenarios'; w=5; sc=2},
  @{s='internal'; n='component_gallery'; u='connecto://component-gallery'; w=5; sc=1},
  @{s='internal'; n='token_gallery'; u='connecto://token-gallery'; w=5; sc=1},
  @{s='internal'; n='layout_qa'; u='connecto://layout-qa'; w=5; sc=1},
  @{s='internal'; n='motion_lab'; u='connecto://motion-lab'; w=5; sc=1},
  @{s='internal'; n='animation_lab'; u='connecto://animation-lab'; w=5; sc=1},
  @{s='internal'; n='account_status_redirect'; u='connecto://account-status'; w=5; sc=0}
)
foreach ($r in $internalRoutes) {
  Capture-Route $r.s $r.n $r.u $r.w $r.sc
}

Remove-Item (Join-Path $root '_tap-window.xml') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $root '_seed-window.xml') -Force -ErrorAction SilentlyContinue

$manifestPath = Join-Path $root 'manifest.csv'
$manifest | Export-Csv -Path $manifestPath -NoTypeInformation -Encoding UTF8

$duration = [int]((Get-Date) - $script:startTime).TotalSeconds
$pngCount = (Get-ChildItem $root -Filter '*.png').Count
$xmlCount = (Get-ChildItem $root -Filter '*.xml').Count
$manifestMd = Join-Path $root 'README.md'
@(
  '# Connecto Mobile Flow Screenshots',
  '',
  "Captured on Pixel_9 emulator from live Expo dev-client bundle on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz').",
  '',
  "- PNG screenshots: $pngCount",
  "- UI XML dumps: $xmlCount",
  "- Manifest rows: $($manifest.Count)",
  "- Duration seconds: $duration",
  '',
  'See `manifest.csv` for route, section, state, PNG/XML file, and visible text snippets.'
) | Set-Content -Path $manifestMd -Encoding UTF8

$zip = "$root.zip"
if (Test-Path $zip) {
  Remove-Item $zip -Force
}
Compress-Archive -Path (Join-Path $root '*') -DestinationPath $zip -CompressionLevel Optimal

Write-Output "DONE_DIR=$root"
Write-Output "DONE_ZIP=$zip"
Write-Output "PNG_COUNT=$pngCount XML_COUNT=$xmlCount MANIFEST_ROWS=$($manifest.Count) DURATION_SECONDS=$duration"
