export interface GeneratedInvitationToken {
  readonly token: string;
  readonly tokenHash: string;
}

export interface InvitationTokenGenerator {
  generate(): Promise<GeneratedInvitationToken>;
  hash(token: string): Promise<string>;
}
