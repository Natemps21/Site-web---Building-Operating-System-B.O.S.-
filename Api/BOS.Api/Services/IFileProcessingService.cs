using Microsoft.AspNetCore.Http;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BOS.Api.Services
{
    public interface IFileProcessingService
    {
        List<string> GetBrutFiles();
        List<string> GetCleanFiles();
        Task UploadBrutFiles(List<IFormFile> files);
        bool DeleteBrutFile(string name);
        bool DeleteCleanFile(string name);
        
        // La méthode principale qui renvoie un objet (status, message, fichiers créés...)
        object ProcessCleaning(bool overwrite);
        
        List<string> GetLogs();
    }
}