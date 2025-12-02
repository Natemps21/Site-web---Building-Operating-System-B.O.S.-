using BOS.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BOS.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FileManagerController : ControllerBase
    {
        private readonly IFileProcessingService _service;

        // Injection de dépendance du service
        public FileManagerController(IFileProcessingService service)
        {
            _service = service;
        }

        [HttpGet("brut/files")]
        public IActionResult GetBrutFiles()
        {
            return Ok(_service.GetBrutFiles());
        }

        [HttpPost("brut/upload")]
        public async Task<IActionResult> UploadBrut([FromForm] List<IFormFile> files)
        {
            if (files == null || files.Count == 0) return BadRequest("Aucun fichier.");
            await _service.UploadBrutFiles(files);
            return Ok();
        }

        [HttpDelete("brut/file")]
        public IActionResult DeleteBrutFile([FromQuery] string name)
        {
            if (_service.DeleteBrutFile(name)) return Ok();
            return NotFound();
        }

        [HttpGet("clean/files")]
        public IActionResult GetCleanFiles()
        {
            return Ok(_service.GetCleanFiles());
        }

        [HttpDelete("clean/file")]
        public IActionResult DeleteCleanFile([FromQuery] string name)
        {
            if (_service.DeleteCleanFile(name)) return Ok();
            return NotFound();
        }

        [HttpPost("nettoyer")]
        public IActionResult Nettoyer([FromQuery] bool overwrite = false)
        {
            var result = _service.ProcessCleaning(overwrite);
            return Ok(result);
        }

        [HttpGet("logactions")]
        public IActionResult GetLastActions()
        {
            return Ok(_service.GetLogs());
        }
    }
}