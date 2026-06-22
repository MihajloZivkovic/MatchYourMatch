namespace MatchYourMatch.WebAPI.Services;
public class AccountDeactivatedException : Exception { public AccountDeactivatedException() : base("This account is deactivated.") { } }
