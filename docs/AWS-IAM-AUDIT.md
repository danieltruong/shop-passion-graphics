# AWS IAM audit — account 380069215548

Audited 2026-08-02. Region focus `ca-central-1`, with `us-east-1` checked for Route53, CDK and
the Minecraft domain stack.

Starting state: 8 IAM users, 31 non-service-linked roles, 11 customer-managed policies, spanning
2020–2026. Outside `shop-passion-*`, nothing had been used since 2023.

The trigger was narrower: deploying the checkout API required temporarily granting
`IAMFullAccess`, `AWSCloudFormationFullAccess` and `AmazonSSMFullAccess` to the
`shop-passion-graphics` user, whose long-lived access keys sit in GitHub repo secrets. That
combination is a privilege-escalation path, so it had to be closed deliberately rather than
forgotten.

## Method

Every judgement below is backed by an observation, not by a name looking stale:

- `iam get-access-key-last-used` for credentials
- `iam get-role` → `RoleLastUsed` for roles
- `cloudformation list-stack-resources` to map roles to owning stacks — a role owned by a live
  stack must not be deleted directly, or the stack drifts
- `lambda list-functions` + `logs describe-log-streams` to prove functions were never invoked
- `cloudtrail lookup-events` (90-day history) for what an active identity actually calls
- `iam simulate-principal-policy` to verify a narrowed policy before and after, including a
  negative control

## Changed

| Change | Evidence |
|---|---|
| `shop-passion-graphics` policy reverted v3 → v2 | v3 (created 18:49 that day) added `iam:*`, `cloudformation:*`, `secretsmanager:*` scoped to `arn:aws:s3:::shop-passion-graphics-*`. An S3 ARN cannot match an IAM action, so it granted nothing — but it read like admin and was one `"Resource": "*"` edit from being it. v3 deleted. |
| Deleted 3 unattached policies | `S3UploadOnly`, `AWSLambdaBasicExecutionRole-d1fcbe80…`, `AWSLambdaBasicExecutionRole-4b0f4f69…` — all `AttachmentCount: 0`, confirmed via `list-entities-for-policy` immediately before deletion. |
| Deactivated 5 stale access keys | RooCode (unused 17 months), nginx_proxy_manager (8), Speaker.bot ×2 (7), half-baked-research key #1 (5). Set `Inactive`, not deleted — reversible, and anything that silently depended on them now fails visibly. |
| `Proxmox`: `AmazonRoute53FullAccess` → `Proxmox-Route53-DDNS` | 90 days of CloudTrail show only `ChangeResourceRecordSets` on two zones, rewriting `*.passion.graphics` (`Z03945872478VJ0EQDAHH`) and `*.peen.exposed` (`Z09663083DFV20W7VSUEK`) — a dynamic-DNS updater. New policy grants exactly that. Verified by simulation: `allowed` on both zones, `implicitDeny` on an unrelated zone. |

## Minecraft — decommissioned, world data preserved

The owner decided to retire the Minecraft server, keeping only the world data. **Done** — see the
outcome at the end of this section. The backup had to come first, because the existing one was
stale:

- `s3://minecraft.peen.exposed/minecraft/` holds 177 objects / 122,492,455 bytes, every one
  timestamped `2023-11-19 08:24`
- but `minecraft-server-stack-TaskRole` was last used at `2023-11-19 14:51` — the server ran for
  roughly six more hours *after* that snapshot
- `datasync list-task-executions` returns nothing: the backup task has never run since

So the S3 copy is missing the final session. A fresh `minecraft-efs-to-s3` execution must
complete and be verified before anything is torn down.

### What happened

1. Ran `minecraft-efs-to-s3`. Result: `SUCCESS`, **37 files / 19,755,388 bytes transferred** —
   confirming the S3 copy really was missing the last session. Backup went from 177 objects to
   **189 objects / 122,904,288 bytes**, with `level.dat` rewritten.
2. Enabled **versioning** on `minecraft.peen.exposed`. It was off, and this backup was about to
   become the only copy.
3. Deleted `minecraft-domain-stack`, then `minecraft-server-stack`.

**The `DeletionPolicy: Snapshot` expectation was wrong.** EFS is not a snapshot-capable type, and
rather than retaining the filesystem, CloudFormation deleted it — `describe-file-systems` now
returns empty. Had the teardown run before the backup, the 37 changed files would have been lost
permanently. The backup-first ordering is the only reason the world survives.

`minecraft-server-stack` then hit `DELETE_FAILED` on a security group and subnet with dependent
objects. The cause was the **DataSync ENIs**: the tasks were never stack-managed, so they outlived
the stack and pinned its networking. Deleting the tasks and locations released four ENIs and the
retry succeeded in ~10 seconds.

Finally, with `minecraft-*` gone there were no CDK-deployed stacks left (`shop-passion-*` is SAM),
so `CDKToolkit` went in both regions along with 10 `cdk-hnb659fds-*` roles. Its asset buckets are
`DeletionPolicy: Retain`, so they survived the stack and were emptied and deleted separately —
both versioned, so object *versions* had to be removed, not just current objects.

**Kept:** `s3://minecraft.peen.exposed` with the full world, now versioned. Restoring means
standing up a new server and syncing that prefix back.

## Kept, deliberately

- **`Proxmox` keeps `AmazonS3FullAccess`.** No CloudTrail trail exists, only the 90-day
  management-event history, which excludes S3 data events. Absence of `GetObject`/`PutObject`
  evidence is not evidence of absence, and this key is used daily. Its Route53 access was
  narrowed; the S3 grant awaits confirmation of what, if anything, Proxmox stores there.
- **`traefik`, `half-baked-research`, `nginx_proxy_manager` users** — belong to other projects.
  Only the stale *keys* were deactivated; no user was deleted.
- **`BedrockAPIKey-34e2`** — left in place, but see below.

## Deleted

**12 roles and 3 policies removed**, plus the non-IAM leftovers they belonged to.

- 6 Cognito roles (`ca-central-1_{SFxT2dAwd,t4j1U6ILF}_*`), 2 user pools, 2 identity pools
- 3 Amplify roles (`amplify-login-lambda-225d91e1`, `amplify-login-lambda-f592184f`,
  `AmplifySSRLoggingRole-…`) and 8 Lambda functions
- 3 EC2-era Minecraft roles (`MinecraftImageBuilderRole` plus its instance profile,
  `start`/`stopMinecraftEC2Instance-role-*`)
- 3 policies (`AmplifySSRLoggingPolicy-…`, two `AWSLambdaBasicExecutionRole-*`)
- later, with the Minecraft teardown: 10 `cdk-hnb659fds-*` roles, the DataSync role and its policy

Evidence the Amplify/Cognito set was abandoned, not merely quiet:

- `amplify list-apps` returns empty in **both** regions — the apps themselves are gone
- all 8 `amplify-login-*` Lambdas had **no log streams at all**: never invoked once since creation
- each Cognito pool held exactly one user, `aws-amplify-admin`, created with the pool in 2023 —
  the Studio backend account, not an end user

The EC2-era Minecraft roles (2020/2021) had `RoleLastUsed: None` and no Lambda referenced them;
that approach was superseded by the ECS/Fargate stack.

## Final state

| | Before | After |
|---|---|---|
| Roles (non-service-linked) | 31 | **2** |
| Customer-managed policies | 11 | **5** |
| Live CloudFormation stacks | 7 | **3** |
| Active access keys | 9 | **4** |

The two surviving roles are `shop-passion-deploy` and
`shop-passion-staging-CheckoutFunctionRole-…`. The remaining stacks are `shop-passion-staging`,
`shop-passion-deploy-role` and `aws-sam-cli-managed-default`.

**Temporary access revoked.** `PowerUserAccess`, `ReadOnlyAccess`, `AmazonSSMFullAccess`,
`AWSCloudFormationFullAccess` and `IAMFullAccess` were all detached from `shop-passion-graphics`
(IAM last, since it authorises the other detaches). Verified afterwards: IAM, CloudFormation, EC2
and SSM all denied; S3 on its own bucket still works. The `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` GitHub repo secrets were deleted — unreferenced since `deploy.yml` moved
to OIDC. The underlying access key was kept, as the local `shop-passion-graphics` CLI profile
uses it.

**Regression check.** After all of the above, the staging deploy was re-run (green) and a real
browser completed add-to-cart → drawer → Stripe redirect with no console errors. The cleanup
broke nothing.

## Outstanding — only the account owner can do these

- **Delete the root access key.** `GetAccountSummary` reports `AccountAccessKeysPresent: 1`.
  Requires a root console login; no IAM identity can remove it. Highest-value action here — root
  MFA is enabled, but a root access key bypasses every control above.
- **`BedrockAPIKey-34e2` holds a service-specific credential expiring 2125-12-23.** A 100-year
  credential; rotate or delete it.
- **No IAM user has MFA.** The 2 registered devices are root's.
- No account password policy is set. Cosmetic: no user has ever signed into the console
  (`PasswordLastUsed: None` for all 8).

## Follow-ups

- The 5 deactivated keys should be **deleted** after a quiet period. Re-check
  `get-access-key-last-used` first; reactivate with `--status Active` if something breaks. If
  nothing has, the four dormant users (`RooCode`, `Speaker.bot`, `nginx_proxy_manager`, and the
  spare `half-baked-research` key) can go entirely.
- **Confirm whether `Proxmox` writes anything to S3.** If not, detach `AmazonS3FullAccess` — it is
  the last broad grant left on an actively used key.
- Restoring Minecraft means standing up a new server and syncing `s3://minecraft.peen.exposed/minecraft/`
  back onto fresh storage. The stacks, EFS, DataSync tasks and CDK bootstrap are all gone; only the
  data and the `peen.exposed` Route53 zone remain.
- If CDK is ever used again, re-run `cdk bootstrap` — the toolkit stacks were removed.
- `infra/deploy-user-bootstrap-policy.json` is the least-privilege set to re-attach when
  bootstrapping prod. Prefer it over the blanket managed policies used during this work.
