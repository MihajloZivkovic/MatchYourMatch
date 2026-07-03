namespace MatchYourMatch.WebAPI.DTOs.Account;
public class ReactivateAccountDto 
{ 
    public string? Email { get; set; } 
    public string? Password { get; set; } 
    public string? Provider { get; set; }
    public string? IdToken { get; set; }
    public string? AccessToken { get; set; } 
}
