namespace MatchYourMatch.WebAPI.Services;

public static class AuthErrorCodes
{
    public const string AccountDeactivated = "ACCOUNT_DEACTIVATED";
}

public class AccountDeactivatedException : Exception
{
    public AccountDeactivatedException()
        : base("This account is deactivated.")
    {
    }
}

public class AdminDeactivatedAccountException : Exception
{
    public string Code => AuthErrorCodes.AccountDeactivated;

    public AdminDeactivatedAccountException()
        : base("Your account has been deactivated by an administrator.")
    {
    }
}
