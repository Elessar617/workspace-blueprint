# Routing Branch: Ship (release artifacts)

## Always load

- Agents: `reviewer`, `adversary`, `doc-updater`, `opensource-packager`
- Skills: none by default
- Rules: all native rules (maximum strictness)
- Hook profile: `strict`
- MCPs (advisory): `filesystem`, `git`, `github`

## Notes

`strict` profile reserved for ship/ workflows. Currently identical to `standard` but hooks honor it as a separate value for future extension.

Binary document-generation skills are intentionally not bundled in the public scaffold. Install compatible skills locally only when their license allows your use case.
